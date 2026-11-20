import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { verifyIionWebhook } from "@/lib/iion";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyIionWebhook(raw, req.headers)) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const event = String(body.event || req.headers.get("x-iion-event-type") || "");
  const paymentId = String(body.data?.id || "");
  const reference = String(body.data?.reference || "");
  if (!event || (!paymentId && !reference)) return NextResponse.json({ error: "Evento incompleto" }, { status: 400 });
  // iion pay no garantiza un ID de evento en el cuerpo. El hash del cuerpo crudo
  // hace que los reintentos del mismo aviso sean idempotentes.
  const eventId = createHash("sha256").update(raw).digest("hex");

  const order = await prisma.order.findFirst({ where: paymentId ? { iionPaymentId: paymentId } : { number: reference } });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.paymentWebhookEvent.create({ data: { id: eventId, event, orderId: order?.id, payload: body } });
      if (!order) return;
      const data: any = { history: { create: { action: `iion pay: ${event}`, actor: "webhook" } } };
      if (["payment.completed", "payment.confirmed"].includes(event)) data.paymentStatus = "APPROVED";
      if (["payment.failed", "payment.expired", "payment.cancelled"].includes(event)) data.paymentStatus = "REJECTED";
      if (["payment.refunded", "payment.partially_refunded", "payment.chargeback"].includes(event)) data.paymentStatus = "REFUNDED";
      await tx.order.update({ where: { id: order.id }, data });
    });
  } catch (error: any) {
    if (error?.code !== "P2002") throw error;
  }
  return NextResponse.json({ received: true });
}
