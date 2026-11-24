import { applyStoreBalances, centralStockEnabled, TrefiStockError } from "@/lib/trefi-stock";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncLeadStageByPhone } from "@/lib/sales-agent";
import { getPublicPrice, IVA_RATE } from "@/lib/utils";

type OrderMeta = {
  inventorySource?: string;
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
  invoiceRequested: boolean;
  invoiceName: string | null;
  invoiceDocument: string | null;
  invoiceEmail: string | null;
  vatRate: number;
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

const existingOrderSelect = { id:true, number:true, subtotal:true, shipping:true, total:true, notes:true } as const;
type StoredOrder = {id:string;number:string;notes:string|null;subtotal:unknown;shipping:unknown;total:unknown};
function duplicateResponse(order:StoredOrder) {
  const details=order.notes?.match(/\[WT_META\]([\s\S]*?)\[\/WT_META\]/)?.[1] ?? "{}";
  let shippingQuoted=false;
  try {shippingQuoted=JSON.parse(details).shippingQuoted===true;} catch {}
  return NextResponse.json({orderNumber:order.number,orderId:order.id,duplicate:true,shippingQuoted,paymentReady:shippingQuoted,
    subtotal:Number(order.subtotal),shipping:Number(order.shipping),total:Number(order.total),vatIncluded:true,vatRate:IVA_RATE});
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer, items } = body;
    const requestId = String(body.requestId || "").trim().slice(0, 100);
    const origin = cleanOrigin(body.origin);
    const fulfillment = body.fulfillment === "PICKUP" ? "PICKUP" : "DELIVERY";
    const invoiceRequested = customer?.needsInvoice === true;
    const invoiceName = String(customer?.invoiceName || "").trim().slice(0, 180);
    const invoiceDocument = String(customer?.invoiceDocument || "").trim().slice(0, 50);
    const invoiceEmail = String(customer?.invoiceEmail || "").trim().toLowerCase().slice(0, 180);
    const paymentChoice = ["IION", "WHATSAPP", "PAY_LATER"].includes(body.paymentChoice)
      ? body.paymentChoice as OrderMeta["paymentChoice"]
      : "WHATSAPP";

    if (
      !customer?.name || !customer?.phone || !customer?.city || !Array.isArray(items) || !items.length ||
      (fulfillment === "DELIVERY" && (!customer?.address || !customer?.barrio))
    ) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    if (invoiceRequested && (
      invoiceName.length < 2 || invoiceDocument.replace(/\D/g, "").length < 5 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceEmail)
    )) {
      return NextResponse.json({ error: "Completa correctamente los datos para la factura electrónica" }, { status: 400 });
    }
    if (items.length > 100) return NextResponse.json({ error: "El pedido supera el máximo de referencias" }, { status: 400 });

    if (centralStockEnabled() && requestId.length<20) return NextResponse.json({error:"Actualiza el carrito para obtener un identificador de pedido."},{status:400});
    const requestFilter = {notes:{contains:'"requestId":'+JSON.stringify(requestId)},customer:{phone:customer.phone}};
    if (requestId) {
      const previous=await prisma.order.findFirst({where:requestFilter,select:existingOrderSelect});
      if (previous) return duplicateResponse(previous);
    }
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
    await applyStoreBalances(products, true);
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
      const netPrice = Number(variant ? variant.price : product.price);
      if (!Number.isFinite(netPrice) || netPrice <= 0) throw new Error("INVALID_PRICE");
      const price = getPublicPrice(netPrice);
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

    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: ["shippingCost", "freeShipFrom"] } },
    });
    const setting = new Map(settings.map(row => [row.key, Number(row.value)]));
    const configuredShipping = setting.get("shippingCost") || 0;
    const freeShipFrom = setting.get("freeShipFrom") || 0;
    const pickup = fulfillment === "PICKUP";
    const hasDeliveryRate = Number.isFinite(configuredShipping) && configuredShipping > 0;
    const freeDelivery = !pickup && freeShipFrom > 0 && subtotal >= freeShipFrom;
    const shippingQuoted = pickup || freeDelivery || hasDeliveryRate;
    const shipping = pickup || freeDelivery ? 0 : hasDeliveryRate ? configuredShipping : 0;
    const total = subtotal + shipping;

    const saved = await prisma.$transaction(async (tx) => {
      if (requestId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"wired-checkout:"+requestId},0))`;
        const previous=await tx.order.findFirst({where:requestFilter,select:existingOrderSelect});
        if (previous)return {order:previous,duplicate:true};
      }
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
        "Precios de productos con IVA (19%) incluido",
        invoiceRequested ? "Factura electrónica solicitada: Sí" : "Factura electrónica solicitada: No",
        invoiceRequested ? `Nombre o razón social: ${invoiceName}` : null,
        invoiceRequested ? `Documento o NIT: ${invoiceDocument}` : null,
        invoiceRequested ? `Correo de facturación: ${invoiceEmail}` : null,
      ].filter(Boolean).join("\n");

      const meta: OrderMeta = {
        inventorySource: centralStockEnabled() ? "trefi" : undefined,
        requestId,
        origin,
        assignedSellerId: null,
        assignedSellerName: null,
        internalNote: "",
        stockValidated: true,
        inventoryApplied: false,
        shippingQuoted,
        fulfillment,
        paymentChoice,
        invoiceRequested,
        invoiceName: invoiceRequested ? invoiceName : null,
        invoiceDocument: invoiceRequested ? invoiceDocument : null,
        invoiceEmail: invoiceRequested ? invoiceEmail : null,
        vatRate: IVA_RATE,
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
          history: { create: {
            action: `Solicitud web · Origen: ${origin} · IVA incluido · ${invoiceRequested ? "Factura solicitada" : "Sin factura solicitada"} · ${shippingQuoted ? `Envío definido $${Math.round(shipping).toLocaleString("es-CO")}` : "Envío por cotizar"} · Pago ${paymentMethod}`,
            actor: "cliente",
          } },
        },
      });

      await tx.notification.create({
        data: {
          type: "order",
          message: `Nuevo pedido ${orderNumber} · Total ${shippingQuoted ? `$${Math.round(total).toLocaleString("es-CO")}` : `$${Math.round(subtotal).toLocaleString("es-CO")} + envío por cotizar`}`,
        },
      });

      return {order,duplicate:false};
    });
    if (saved.duplicate) return duplicateResponse(saved.order);
    const result=saved.order;

    try {
      await syncLeadStageByPhone(customer.phone, "SCHEDULED", `Pedido ${result.number} creado · envío pendiente de cotización`);
    } catch (syncError) {
      console.error("[CRM_STAGE_SYNC] No se pudo sincronizar pedido nuevo", syncError);
    }

    return NextResponse.json({
      orderNumber: result.number,
      orderId: result.id,
      shippingQuoted,
      paymentReady: shippingQuoted,
      subtotal,
      shipping,
      total,
      vatIncluded: true,
      vatRate: IVA_RATE,
    });
  } catch (error: any) {
    if (error instanceof TrefiStockError) return NextResponse.json({error:error.message},{status:error.status});
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
