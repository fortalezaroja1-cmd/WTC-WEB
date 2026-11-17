import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createIionCollect } from "@/lib/iion";

function shippingQuoted(notes: string | null) {
  const match = (notes || "").match(/\[WT_META\]([\s\S]*?)\[\/WT_META\]/);
  if (!match?.[1]) return false;
  try { return JSON.parse(match[1]).shippingQuoted === true; } catch { return false; }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const { orderId } = await req.json();
    const order = await prisma.order.findUnique({ where: { id: String(orderId || "") }, include: { customer: true } });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    if (!shippingQuoted(order.notes)) return NextResponse.json({ error: "Primero registra el valor final del envío" }, { status: 409 });
    if (order.paymentStatus === "APPROVED") return NextResponse.json({ error: "Este pedido ya está pagado" }, { status: 409 });
    if (order.iionCollectUrl && order.iionExpiresAt && order.iionExpiresAt > new Date()) {
      return NextResponse.json({ collectUrl: order.iionCollectUrl, paymentId: order.iionPaymentId, expiresAt: order.iionExpiresAt });
    }
    const amount = Math.round(Number(order.total));
    if (!Number.isFinite(amount) || amount < 5000) return NextResponse.json({ error: "El total debe ser de al menos $5.000" }, { status: 400 });

    const payment = await createIionCollect({
      reference: order.number,
      amount,
      description: `Pedido ${order.number} - Wired Technology`,
      customerName: order.customer?.name,
      customerEmail: order.customer?.email,
      metadata: { system: "catalog", orderId: order.id, orderNumber: order.number },
      idempotencyKey: `catalog:${order.id}:${amount}`,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentProvider: "IION",
        paymentMethod: "iion pay",
        iionPaymentId: payment.id,
        iionCollectUrl: payment.collectUrl,
        iionExpiresAt: new Date(payment.expiresAt),
        history: { create: { action: "Enlace de pago iion pay generado", actor: session.name } },
      },
    });
    return NextResponse.json({ collectUrl: payment.collectUrl, paymentId: payment.id, expiresAt: payment.expiresAt });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "IION_NOT_CONFIGURED" ? "iion pay aún no está configurado" : "No se pudo generar el enlace de pago" }, { status: 503 });
  }
}
