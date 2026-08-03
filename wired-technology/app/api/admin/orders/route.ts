import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const orders = await prisma.order.findMany({
    include: { customer: true, items: true, history: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

export async function PUT(req: NextRequest) {
  const { id, paymentStatus, shipStatus, guide, notes } = await req.json();

  const data: any = {};
  const historyEntries: string[] = [];

  if (paymentStatus) { data.paymentStatus = paymentStatus; historyEntries.push(`Pago: ${paymentStatus}`); }
  if (shipStatus) { data.shipStatus = shipStatus; historyEntries.push(`Envío: ${shipStatus}`); }
  if (guide !== undefined) { data.guide = guide; if (guide) historyEntries.push(`Guía: ${guide}`); }
  if (notes !== undefined) { data.notes = notes; }

  const order = await prisma.order.update({
    where: { id },
    data: {
      ...data,
      history: historyEntries.length ? {
        create: historyEntries.map((action) => ({ action, actor: "admin" })),
      } : undefined,
    },
    include: { customer: true, items: true, history: { orderBy: { createdAt: "desc" } } },
  });

  return NextResponse.json(order);
}
