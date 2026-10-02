import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const q = String(req.nextUrl.searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json([]);
    const can = (p: string) =>
      session.role === "ADMIN" || session.permissions?.includes(p as any);
    const results: any[] = [];

    if (can("orders.view")) {
      const orders = await prisma.order.findMany({
        where: {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q } } },
          ],
        },
        include: { customer: true },
        take: 6,
        orderBy: { updatedAt: "desc" },
      });
      results.push(
        ...orders.map((o) => ({
          type: "Pedido",
          title: o.number,
          subtitle: (o.customer?.name || "Cliente") + " · " + o.shipStatus,
          href: "/admin/pedidos?orderId=" + o.id,
        })),
      );
    }

    if (can("products.view")) {
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            {
              variants: {
                some: {
                  OR: [
                    { sku: { contains: q, mode: "insensitive" } },
                    { name: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
        take: 6,
        orderBy: { updatedAt: "desc" },
      });
      results.push(
        ...products.map((p) => ({
          type: "Producto",
          title: p.name,
          subtitle: p.sku,
          href: "/admin/productos",
        })),
      );
    }

    return NextResponse.json(results.slice(0, 24), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[GLOBAL_SEARCH]", error);
    return NextResponse.json({ error: "No se pudo buscar" }, { status: 500 });
  }
}
