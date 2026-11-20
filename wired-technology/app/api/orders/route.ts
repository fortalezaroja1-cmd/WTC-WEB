import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncLeadStageByPhone } from "@/lib/sales-agent";

type OrderMeta = {
  requestId: string;
  origin: string;
  assignedSellerId: string | null;
  assignedSellerName: string | null;
  internalNote: string;
  stockValidated: boolean;
  inventoryApplied: boolean;
  shippingQuoted: boolean;
  fulfillment: "DELIVERY" | "PICKUP";
  paymentChoice: "IION" | "WHATSAPP" | "PAY_LATER";
};

function buildNotes(meta: OrderMeta, visibleNotes: string) {
  return `[WT_META]${JSON.stringify(meta)}[/WT_META]${visibleNotes ? `\n${visibleNotes}` : ""}`;
}

function cleanOrigin(value: unknown) {
  const origin = String(value || "Web").trim().slice(0, 80);
  return origin || "Web";
}

async function nextOrderNumber(tx: any) {
  // Serializa únicamente la generación del consecutivo para evitar pedidos duplicados por carrera.
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(57392026)");
  const existing = await tx.order.findMany({
    select: { number: true },
    where: { number: { startsWith: "WT-" } },
  });

  let max = 0;
  for (const row of existing) {
    const match = /^WT-(\d{6})$/.exec(row.number);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `WT-${String(max + 1).padStart(6, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer, items } = body;
    const requestId = String(body.requestId || "").trim().slice(0, 100);
    const origin = cleanOrigin(body.origin);
    const fulfillment = body.fulfillment === "PICKUP" ? "PICKUP" : "DELIVERY";
    const paymentChoice = ["IION", "WHATSAPP", "PAY_LATER"].includes(body.paymentChoice)
      ? body.paymentChoice as OrderMeta["paymentChoice"]
      : "WHATSAPP";

    if (
      !customer?.name || !customer?.phone || !customer?.city || !Array.isArray(items) || !items.length ||
      (fulfillment === "DELIVERY" && (!customer?.address || !customer?.barrio))
    ) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    if (items.length > 100) return NextResponse.json({ error: "El pedido supera el máximo de referencias" }, { status: 400 });

    const productIds = [...new Set(items.map((item: any) => String(item.productId || "")).filter(Boolean))];
    if (productIds.length !== new Set(items.map((item: any) => String(item.productId || ""))).size) {
      return NextResponse.json({ error: "Hay productos sin identificar" }, { status: 400 });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stock: true,
        variants: {
          where: { active: true },
          select: { id: true, name: true, sku: true, price: true, stock: true },
        },
      },
    });
    const productById = new Map(products.map(product => [product.id, product]));
    const validatedItems = items.map((item: any) => {
      const product = productById.get(String(item.productId || ""));
      const qty = Number(item.qty);
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 999) throw new Error("INVALID_ITEM");
      const variantId = item.variantId ? String(item.variantId) : null;
      const variant = variantId ? product.variants.find(candidate => candidate.id === variantId) : null;
      if (variantId && !variant) throw new Error("INVALID_VARIANT");
      if (!variantId && product.variants.length) throw new Error("VARIANT_REQUIRED");
      const stock = variant ? variant.stock : product.stock;
      if (stock < qty) throw new Error("INSUFFICIENT_STOCK");
      const price = Number(variant ? variant.price : product.price);
      if (!Number.isFinite(price) || price <= 0) throw new Error("INVALID_PRICE");
      return {
        name: variant ? `${product.name} · ${variant.name}` : product.name,
        sku: variant?.sku || product.sku,
        qty,
        price,
        total: price * qty,
        productId: product.id,
        variantId: variant?.id || null,
      };
    });
    const subtotal = validatedItems.reduce((sum, item) => sum + item.total, 0);

    // Los pedidos armados por el cliente nunca presumen envío gratis.
    // Hasta que logística/Skydropx cotice el flete, shipping se mantiene en 0
    // únicamente como valor técnico y shippingQuoted=false define su significado real.
    const shipping = 0;
    const total = subtotal;

    // Idempotencia: si el navegador reintenta exactamente la misma solicitud, devolvemos la orden ya creada.
    if (requestId) {
      const existingOrder = await prisma.order.findFirst({
        where: { notes: { contains: requestId } },
        select: { id: true, number: true },
      });
      if (existingOrder) {
        return NextResponse.json({ orderNumber: existingOrder.number, orderId: existingOrder.id, duplicate: true, subtotal });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let dbCustomer = await tx.customer.findFirst({ where: { phone: customer.phone } });
      const customerNotes = [
        fulfillment === "PICKUP" ? "Modalidad: Recoger en tienda" : "Modalidad: Entrega a domicilio",
        fulfillment === "DELIVERY" && customer.barrio ? `Barrio: ${customer.barrio}` : null,
        fulfillment === "DELIVERY" && customer.reference ? `Referencia: ${customer.reference}` : null,
      ].filter(Boolean).join("\n");

      if (!dbCustomer) {
        dbCustomer = await tx.customer.create({
          data: {
            name: customer.name,
            phone: customer.phone,
            email: customer.email || null,
            address: fulfillment === "DELIVERY" ? customer.address : null,
            city: customer.city,
            notes: customerNotes || null,
          },
        });
      } else {
        dbCustomer = await tx.customer.update({
          where: { id: dbCustomer.id },
          data: {
            name: customer.name,
            email: customer.email || dbCustomer.email,
            address: fulfillment === "DELIVERY" ? customer.address : dbCustomer.address,
            city: customer.city,
            notes: customerNotes || dbCustomer.notes,
          },
        });
      }

      const orderNumber = await nextOrderNumber(tx);
      const visibleNotes = [
        fulfillment === "PICKUP" ? "Modalidad: Recoger en tienda" : "Modalidad: Entrega a domicilio",
        fulfillment === "DELIVERY" && customer.barrio ? `Barrio: ${customer.barrio}` : null,
        fulfillment === "DELIVERY" && customer.reference ? `Referencia de entrega: ${customer.reference}` : null,
        customer.notes ? `Observaciones del cliente: ${customer.notes}` : null,
      ].filter(Boolean).join("\n");

      const meta: OrderMeta = {
        requestId,
        origin,
        assignedSellerId: null,
        assignedSellerName: null,
        internalNote: "",
        stockValidated: false,
        inventoryApplied: false,
        shippingQuoted: false,
        fulfillment,
        paymentChoice,
      };

      const paymentMethod = paymentChoice === "IION"
        ? "iion pay — pendiente de enlace de pago"
        : paymentChoice === "PAY_LATER"
          ? "Pago al recibir — sujeto a confirmación"
          : "Por confirmar con asesor";

      const order = await tx.order.create({
        data: {
          number: orderNumber,
          customerId: dbCustomer.id,
          subtotal,
          shipping,
          total,
          paymentMethod,
          notes: buildNotes(meta, visibleNotes),
          items: {
            create: validatedItems.map((it) => ({
              name: it.name,
              sku: it.sku,
              qty: it.qty,
              unitPrice: it.price,
              total: it.total,
              productId: it.productId || null,
              variantId: it.variantId || null,
            })),
          },
          history: {
            create: { action: `Solicitud web · Origen: ${origin} · Envío por cotizar · Pago ${paymentMethod}`, actor: "cliente" },
          },
        },
      });

      await tx.notification.create({
        data: {
          type: "order",
          message: `Nuevo pedido ${orderNumber} · Productos $${Math.round(subtotal).toLocaleString("es-CO")} + envío por cotizar`,
        },
      });

      return order;
    });

    try {
      await syncLeadStageByPhone(customer.phone, "SCHEDULED", `Pedido ${result.number} creado · envío pendiente de cotización`);
    } catch (syncError) {
      console.error("[CRM_STAGE_SYNC] No se pudo sincronizar pedido nuevo", syncError);
    }

    return NextResponse.json({ orderNumber: result.number, orderId: result.id, shippingQuoted: false, subtotal });
  } catch (error: any) {
    if (error?.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "La disponibilidad cambió. Revisa las cantidades e inténtalo de nuevo." }, { status: 409 });
    }
    if (["INVALID_ITEM", "INVALID_VARIANT", "VARIANT_REQUIRED", "INVALID_PRICE"].includes(error?.message)) {
      return NextResponse.json({ error: "Uno de los productos ya no coincide con el catálogo. Actualiza el carrito." }, { status: 409 });
    }
    console.error("Error creando pedido:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
