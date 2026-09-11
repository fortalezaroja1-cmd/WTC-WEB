import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer, items, subtotal, shipping, total } = body;

    if (!customer?.name || !customer?.phone || !customer?.address || !customer?.city || !customer?.barrio || !items?.length) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    let dbCustomer = await prisma.customer.findFirst({ where: { phone: customer.phone } });
    const customerNotes = [
      customer.barrio ? `Barrio: ${customer.barrio}` : null,
      customer.reference ? `Referencia: ${customer.reference}` : null,
    ].filter(Boolean).join("\n");

    if (!dbCustomer) {
      dbCustomer = await prisma.customer.create({
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
      dbCustomer = await prisma.customer.update({
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

    const orderNumber = generateOrderNumber();
    const orderNotes = [
      customer.barrio ? `Barrio: ${customer.barrio}` : null,
      customer.reference ? `Referencia de entrega: ${customer.reference}` : null,
      customer.notes ? `Observaciones: ${customer.notes}` : null,
    ].filter(Boolean).join("\n");

    const order = await prisma.order.create({
      data: {
        number: orderNumber,
        customerId: dbCustomer.id,
        subtotal,
        shipping,
        total,
        paymentMethod: "Pago en casa / contraentrega",
        notes: orderNotes || null,
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
          create: { action: "Solicitud de pedido creada desde la tienda", actor: "cliente" },
        },
      },
    });

    await prisma.notification.create({
      data: {
        type: "order",
        message: `Nueva solicitud ${orderNumber} por $${Math.round(total).toLocaleString("es-CO")}`,
      },
    });

    return NextResponse.json({ orderNumber: order.number, orderId: order.id });
  } catch (error: any) {
    console.error("Error creando pedido:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
