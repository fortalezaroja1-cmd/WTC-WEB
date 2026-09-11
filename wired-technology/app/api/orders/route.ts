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
    const { customer, items, subtotal, shipping, total } = body;
    const requestId = String(body.requestId || "").trim().slice(0, 100);
    const origin = cleanOrigin(body.origin);

    if (!customer?.name || !customer?.phone || !customer?.address || !customer?.city || !customer?.barrio || !items?.length) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    // Idempotencia: si el navegador reintenta exactamente la misma solicitud, devolvemos la orden ya creada.
    if (requestId) {
      const existingOrder = await prisma.order.findFirst({
        where: { notes: { contains: requestId } },
        select: { id: true, number: true },
      });
      if (existingOrder) {
        return NextResponse.json({ orderNumber: existingOrder.number, orderId: existingOrder.id, duplicate: true });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let dbCustomer = await tx.customer.findFirst({ where: { phone: customer.phone } });
      const customerNotes = [
        customer.barrio ? `Barrio: ${customer.barrio}` : null,
        customer.reference ? `Referencia: ${customer.reference}` : null,
      ].filter(Boolean).join("\n");

      if (!dbCustomer) {
        dbCustomer = await tx.customer.create({
          data: {
            name: customer.name,
            phone: customer.phone,
            email: customer.email || null,
            address: customer.address,
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
            address: customer.address,
            city: customer.city,
            notes: customerNotes || dbCustomer.notes,
          },
        });
      }

      const orderNumber = await nextOrderNumber(tx);
      const visibleNotes = [
        customer.barrio ? `Barrio: ${customer.barrio}` : null,
        customer.reference ? `Referencia de entrega: ${customer.reference}` : null,
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
      };

      const order = await tx.order.create({
        data: {
          number: orderNumber,
          customerId: dbCustomer.id,
          subtotal,
          shipping,
          total,
          paymentMethod: "Pago en casa / contraentrega",
          notes: buildNotes(meta, visibleNotes),
          items: {
            create: items.map((it: any) => ({
              name: it.name,
              sku: it.sku,
              qty: it.qty,
              unitPrice: it.price,
              total: it.price * it.qty,
              productId: it.productId || null,
              variantId: it.variantId || null,
            })),
          },
          history: {
            create: { action: `Pedido nuevo · Origen: ${origin}`, actor: "cliente" },
          },
        },
      });

      await tx.notification.create({
        data: {
          type: "order",
          message: `Nuevo pedido ${orderNumber} por $${Math.round(Number(total)).toLocaleString("es-CO")}`,
        },
      });

      return order;
    });

    try {
      await syncLeadStageByPhone(customer.phone, "SCHEDULED", `Pedido ${result.number} creado · lead movido automáticamente a Programado`);
    } catch (syncError) {
      console.error("[CRM_STAGE_SYNC] No se pudo sincronizar pedido nuevo", syncError);
    }

    return NextResponse.json({ orderNumber: result.number, orderId: result.id });
  } catch (error: any) {
    console.error("Error creando pedido:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
