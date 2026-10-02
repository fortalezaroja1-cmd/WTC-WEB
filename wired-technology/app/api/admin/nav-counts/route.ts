import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const allowed =
    session.role === "ADMIN" || session.permissions?.includes("orders.view");
  const newOrders = allowed
    ? await prisma.order.count({ where: { shipStatus: "PENDING_PAYMENT" } })
    : 0;
  return NextResponse.json(
    { newOrders },
    { headers: { "Cache-Control": "no-store" } },
  );
}
