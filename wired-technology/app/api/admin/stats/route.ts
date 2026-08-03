import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [orders, products, notifications] = await Promise.all([
    prisma.order.findMany({ include: { items: true } }),
    prisma.product.findMany({ include: { variants: true } }),
    prisma.notification.findMany({ where: { read: false }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const now = Date.now();
  const day = 864e5;
  const paid = orders.filter((o) => o.paymentStatus === "APPROVED");
  const inRange = (o: any, days: number) => new Date(o.createdAt).getTime() >= now - days * day;

  const salesToday = paid.filter((o) => inRange(o, 1)).reduce((s, o) => s + Number(o.total), 0);
  const salesWeek = paid.filter((o) => inRange(o, 7)).reduce((s, o) => s + Number(o.total), 0);
  const salesTotal = paid.reduce((s, o) => s + Number(o.total), 0);
  const pendingOrders = orders.filter((o) => o.paymentStatus === "PENDING").length;

  // Productos agotados / bajo stock
  const outOfStock: any[] = [];
  const lowStock: any[] = [];
  products.forEach((p) => {
    const items = p.variants.length ? p.variants.map((v) => ({ name: `${p.name} · ${v.name}`, sku: v.sku, stock: v.stock }))
      : [{ name: p.name, sku: p.sku, stock: p.stock }];
    items.forEach((it) => {
      if (it.stock <= 0) outOfStock.push(it);
      else if (it.stock <= 5) lowStock.push(it);
    });
  });

  // Más vendidos
  const soldMap: Record<string, number> = {};
  paid.forEach((o) => o.items.forEach((it) => { soldMap[it.name] = (soldMap[it.name] || 0) + it.qty; }));
  const topSold = Object.entries(soldMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));

  return NextResponse.json({
    salesToday, salesWeek, salesTotal, pendingOrders,
    outOfStock: outOfStock.length, lowStock: lowStock.length,
    lowStockItems: [...outOfStock.map((x) => ({ ...x, out: true })), ...lowStock].slice(0, 8),
    topSold,
    recentOrders: orders.slice(0, 5).map((o) => ({
      number: o.number, customerName: "—", total: Number(o.total), paymentStatus: o.paymentStatus, createdAt: o.createdAt,
    })),
    notifications,
  });
}
