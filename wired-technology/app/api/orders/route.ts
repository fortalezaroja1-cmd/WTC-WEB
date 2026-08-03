import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer, items, subtotal, shipping, total } = body;

    if (!customer?.name || !customer?.phone || !customer?.address || !customer?.city || !items?.length) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    // Crear o encontrar cliente
    let dbCustomer = await prisma.customer.findFirst({ where: { phone: customer.phone } });
    if (!dbCustomer) {
      dbCustomer = await prisma.customer.create({ data: customer });
    }

    const orderNumber = generateOrderNumber();

    // Crear pedido con items
    const order = await prisma.order.create({
      data: {
        number: orderNumber,
        customerId: dbCustomer.id,
        subtotal,
        shipping,
        total,
        paymentMethod: "Mercado Pago / WhatsApp",
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
          create: { action: "Pedido creado desde la tienda", actor: "cliente" },
        },
      },
    });

    // Descontar inventario
    for (const it of items) {
      if (it.variantId) {
        await prisma.variant.update({
          where: { id: it.variantId },
          data: { stock: { decrement: it.qty } },
        });
        await prisma.stockMovement.create({
          data: { type: "SALE", qty: -it.qty, reason: `Venta pedido ${orderNumber}`, productId: it.productId, variantId: it.variantId },
        });
      } else if (it.productId) {
        await prisma.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.qty } },
        });
        await prisma.stockMovement.create({
          data: { type: "SALE", qty: -it.qty, reason: `Venta pedido ${orderNumber}`, productId: it.productId },
        });
      }
    }

    // Notificación
    await prisma.notification.create({
      data: { type: "order", message: `Nuevo pedido ${orderNumber} por $${Math.round(total).toLocaleString("es-CO")}` },
    });

    return NextResponse.json({ orderNumber: order.number, orderId: order.id });
  } catch (error: any) {
    console.error("Error creando pedido:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
