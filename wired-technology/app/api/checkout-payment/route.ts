import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createIionCollect } from "@/lib/iion";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId") || "";
  const requestId = req.nextUrl.searchParams.get("requestId") || "";
  if (requestId.length < 20 || requestId.length > 100) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { notes: true, paymentStatus: true, total: true } });
  const metaText = order?.notes?.match(/\[WT_META\]([\s\S]*?)\[\/WT_META\]/)?.[1];
  let meta: { requestId?: string; shippingQuoted?: boolean } = {};
  try { meta = JSON.parse(metaText || "{}"); } catch {}
  if (!order || !metaText || meta.requestId !== requestId) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  return NextResponse.json({ paymentStatus: order.paymentStatus, total: meta.shippingQuoted ? Number(order.total) : null });
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, requestId } = await req.json();
    if (typeof orderId !== "string" || typeof requestId !== "string" || requestId.length < 20 || requestId.length > 100) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    }
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
    const metaText = order?.notes?.match(/\[WT_META\]([\s\S]*?)\[\/WT_META\]/)?.[1];
    let meta: { requestId?: string; shippingQuoted?: boolean; stockValidated?: boolean } = {};
    try { meta = JSON.parse(metaText || "{}"); } catch {}
    if (!order || meta.requestId !== requestId || !metaText) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    if (order.paymentStatus === "APPROVED") return NextResponse.json({ error: "Este pedido ya está pagado" }, { status: 409 });
    if (!meta.shippingQuoted || !meta.stockValidated) return NextResponse.json({ error: "Estamos confirmando inventario y costo final de entrega. Te avisaremos cuando puedas pagar." }, { status: 409 });
    if (order.iionCollectUrl && order.iionExpiresAt && order.iionExpiresAt > new Date()) {
      return NextResponse.json({ collectUrl: order.iionCollectUrl, amount: Number(order.total) });
    }
    const amount = Math.round(Number(order.total));
    if (!Number.isFinite(amount) || amount < 5000) return NextResponse.json({ error: "El total debe ser de al menos $5.000" }, { status: 400 });
    const payment = await createIionCollect({
      reference: order.number, amount, description: `Pedido ${order.number} - Wired Technology`,
      customerName: order.customer?.name, customerEmail: order.customer?.email,
      metadata: { system: "catalog", orderId: order.id, orderNumber: order.number },
    });
    await prisma.order.update({ where: { id: order.id }, data: {
      paymentProvider: "IION", paymentMethod: "iion pay", iionPaymentId: payment.id,
      iionCollectUrl: payment.collectUrl, iionExpiresAt: new Date(payment.expiresAt),
      history: { create: { action: "Enlace de pago iion pay generado por cliente", actor: "cliente" } },
    } });
    return NextResponse.json({ collectUrl: payment.collectUrl, amount });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "IION_NOT_CONFIGURED" ? "El pago en línea aún no está disponible. Escríbenos por WhatsApp." : "No pudimos preparar el pago. Inténtalo de nuevo." }, { status: 503 });
  }
}
