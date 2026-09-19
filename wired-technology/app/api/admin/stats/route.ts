import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSalesTables, syncOpportunitiesFromLeads } from "@/lib/sales-system";

export async function GET() {
  await ensureSalesTables();
  await syncOpportunitiesFromLeads();
  const [orders, products, notifications, opportunities, quotes] = await Promise.all([
    prisma.order.findMany({ include: { items: true, customer: true }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ include: { variants: true } }),
    prisma.notification.findMany({ where: { read: false }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.$queryRawUnsafe<any[]>('SELECT * FROM "Opportunity" ORDER BY "updatedAt" DESC LIMIT 1000'),
    prisma.$queryRawUnsafe<any[]>('SELECT * FROM "Quote" ORDER BY "createdAt" DESC LIMIT 1000'),
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

  const openStages = new Set(["NEW","CONTACTED","QUOTED","NEGOTIATION"]);
  const openOpps = opportunities.filter((o: any) => openStages.has(o.stage));
  const pipelineValue = openOpps.reduce((s: number, o: any) => s + Number(o.value || 0), 0);
  const overdueFollowups = openOpps.filter((o: any) => o.nextAt && new Date(o.nextAt).getTime() <= now).length;
  const unassignedOpportunities = openOpps.filter((o: any) => !o.assignedSellerId).length;
  const wonOpps = opportunities.filter((o: any) => o.stage === "WON");
  const lostOpps = opportunities.filter((o: any) => o.stage === "LOST");
  const opportunityConversion = (wonOpps.length + lostOpps.length) ? wonOpps.length / (wonOpps.length + lostOpps.length) * 100 : 0;
  const pipelineByStage = ["NEW","CONTACTED","QUOTED","NEGOTIATION","WON","LOST"].map((stage) => ({
    stage,
    count: opportunities.filter((o: any) => o.stage === stage).length,
    value: opportunities.filter((o: any) => o.stage === stage).reduce((s: number, o: any) => s + Number(o.value || 0), 0),
  }));

  return NextResponse.json({
    salesToday, salesWeek, salesTotal, pendingOrders,
    pipelineValue, openOpportunities: openOpps.length, overdueFollowups, unassignedOpportunities,
    wonOpportunities: wonOpps.length, lostOpportunities: lostOpps.length, opportunityConversion, pipelineByStage,
    quotesTotal: quotes.length, quotesOpen: quotes.filter((q: any) => ["DRAFT","SENT"].includes(q.status)).length,
    outOfStock: outOfStock.length, lowStock: lowStock.length,
    lowStockItems: [...outOfStock.map((x) => ({ ...x, out: true })), ...lowStock].slice(0, 8),
    topSold,
    recentOrders: orders.slice(0, 5).map((o) => ({
      number: o.number, customerName: o.customer?.name || "—", total: Number(o.total), paymentStatus: o.paymentStatus, createdAt: o.createdAt,
    })),
    notifications,
  });
}
