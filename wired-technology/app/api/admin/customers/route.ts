import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureCrmTables } from "@/lib/crm";
import { ensureSalesTables, syncOpportunitiesFromLeads } from "@/lib/sales-system";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureCrmTables();
    await ensureSalesTables();
    await syncOpportunitiesFromLeads();
    const id = req.nextUrl.searchParams.get("id");

    if (!id) {
      const customers = await prisma.customer.findMany({
        include: { orders: { select: { id: true, total: true, paymentStatus: true, shipStatus: true, createdAt: true }, orderBy: { createdAt: "desc" } } },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json(customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        city: c.city,
        notes: c.notes,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        orderCount: c.orders.length,
        paidTotal: c.orders.filter(o => o.paymentStatus === "APPROVED").reduce((s,o)=>s+Number(o.total),0),
        lastOrderAt: c.orders[0]?.createdAt || null,
      })));
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { orders: { include: { items: true, history: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } } },
    });
    if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const phone = customer.phone || "";
    const leads = phone ? await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "Lead" WHERE "phone"=$1 ORDER BY "updatedAt" DESC LIMIT 50',
      phone
    ) : [];
    const opportunities = phone ? await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "Opportunity" WHERE "phone"=$1 ORDER BY "updatedAt" DESC LIMIT 100',
      phone
    ) : [];
    const oppIds = opportunities.map((o:any)=>o.id);
    const quotes = oppIds.length ? await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "Quote" WHERE "opportunityId" = ANY($1::text[]) ORDER BY "createdAt" DESC',
      oppIds
    ) : [];
    const salesActivities = oppIds.length ? await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "SalesActivity" WHERE "opportunityId" = ANY($1::text[]) ORDER BY "createdAt" DESC LIMIT 100',
      oppIds
    ) : [];
    const leadIds = leads.map((l:any)=>l.id);
    const crmActivities = leadIds.length ? await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "CrmActivity" WHERE "leadId" = ANY($1::text[]) ORDER BY "createdAt" DESC LIMIT 100',
      leadIds
    ) : [];

    const timeline = [
      ...salesActivities.map((a:any)=>({id:a.id,type:a.type,text:a.text,actorName:a.actorName||"Sistema",createdAt:a.createdAt,source:"SALES"})),
      ...crmActivities.map((a:any)=>({id:a.id,type:a.type,text:a.text,actorName:"CRM",createdAt:a.createdAt,source:"CRM"})),
      ...customer.orders.flatMap(o=>o.history.map(h=>({id:h.id,type:"ORDER",text:o.number+" · "+h.action,actorName:h.actor||"Sistema",createdAt:h.createdAt,source:"ORDER"}))),
    ].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,150);

    return NextResponse.json({
      ...customer,
      leads,
      opportunities,
      quotes,
      timeline,
      paidTotal: customer.orders.filter(o=>o.paymentStatus==="APPROVED").reduce((s,o)=>s+Number(o.total),0),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[CUSTOMERS_GET]", error);
    return NextResponse.json({ error: "No se pudieron cargar los clientes" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const body = await req.json();
    const id = String(body?.id || "");
    if (!id) return NextResponse.json({ error: "Cliente requerido" }, { status: 400 });
    const current = await prisma.customer.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    const data: any = {};
    for (const key of ["name","phone","email","address","city","notes"]) {
      if (body[key] !== undefined) data[key] = body[key] === "" ? null : String(body[key]);
    }
    if (data.name == null) delete data.name;
    const updated = await prisma.customer.update({ where: { id }, data });
    if (current.phone && data.phone && current.phone !== data.phone) {
      await ensureCrmTables();
      await ensureSalesTables();
      await prisma.$executeRawUnsafe('UPDATE "Opportunity" SET "phone"=$2,"updatedAt"=NOW() WHERE "phone"=$1', current.phone, data.phone);
    }
    await writeAudit({ actorUserId: session.userId, actorName: session.name, action: "CUSTOMER_UPDATED", meta: { customerId: id, fields: Object.keys(data) } });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[CUSTOMERS_PUT]", error);
    return NextResponse.json({ error: error?.message || "No se pudo actualizar el cliente" }, { status: 500 });
  }
}
