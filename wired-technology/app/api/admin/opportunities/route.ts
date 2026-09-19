import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { addSalesActivity, ensureSalesTables, OPPORTUNITY_STAGES, syncOpportunitiesFromLeads } from "@/lib/sales-system";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function stageToLead(stage: string) {
  if (stage === "WON") return "CLOSED";
  if (stage === "LOST") return "LOST";
  return stage;
}

async function getOne(id: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT o.*,
       COALESCE(q."quoteCount",0)::int AS "quoteCount",
       q."latestQuoteNumber",
       q."latestQuoteStatus"
     FROM "Opportunity" o
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS "quoteCount",
              (ARRAY_AGG("number" ORDER BY "createdAt" DESC))[1] AS "latestQuoteNumber",
              (ARRAY_AGG("status" ORDER BY "createdAt" DESC))[1] AS "latestQuoteStatus"
       FROM "Quote" WHERE "opportunityId"=o."id"
     ) q ON true
     WHERE o."id"=$1 LIMIT 1`,
    id
  );
  if (!rows[0]) return null;
  const [activities, quotes] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "SalesActivity" WHERE "opportunityId"=$1 ORDER BY "createdAt" DESC LIMIT 100`,
      id
    ),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Quote" WHERE "opportunityId"=$1 ORDER BY "createdAt" DESC LIMIT 50`,
      id
    ),
  ]);
  return { ...rows[0], activities, quotes };
}

export async function GET(req: NextRequest) {
  try {
    await ensureSalesTables();
    await syncOpportunitiesFromLeads();
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const item = await getOne(id);
      if (!item) return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });
      return NextResponse.json(item);
    }
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT o.*,
             COALESCE(q."quoteCount",0)::int AS "quoteCount",
             q."latestQuoteNumber",
             q."latestQuoteStatus"
      FROM "Opportunity" o
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS "quoteCount",
               (ARRAY_AGG("number" ORDER BY "createdAt" DESC))[1] AS "latestQuoteNumber",
               (ARRAY_AGG("status" ORDER BY "createdAt" DESC))[1] AS "latestQuoteStatus"
        FROM "Quote" WHERE "opportunityId"=o."id"
      ) q ON true
      ORDER BY
        CASE WHEN o."stage" IN ('WON','LOST') THEN 1 ELSE 0 END,
        o."nextAt" ASC NULLS LAST,
        o."updatedAt" DESC
      LIMIT 1000
    `);
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[OPPORTUNITIES_GET]", error);
    return NextResponse.json({ error: "No se pudieron cargar las oportunidades" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSalesTables();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const body = await req.json();
    const title = String(body?.title || "").trim();
    const customerName = String(body?.customerName || "").trim();
    if (!title && !customerName) return NextResponse.json({ error: "Indica cliente o nombre de la oportunidad" }, { status: 400 });
    const stage = OPPORTUNITY_STAGES.includes(String(body?.stage || "NEW") as any) ? String(body?.stage || "NEW") : "NEW";
    const matchedCustomer = body?.customerId ? await prisma.customer.findUnique({ where: { id: String(body.customerId) } }) : body?.phone ? await prisma.customer.findFirst({ where: { phone: String(body.phone) }, orderBy: { updatedAt: "desc" } }) : null;
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Opportunity" (
        "id","leadId","customerId","customerName","phone","email","city","address","title","value","stage","source",
        "assignedSellerId","assignedSellerName","priority","nextAction","nextAt","notes","createdAt","updatedAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW())`,
      id,
      body?.leadId || null,
      matchedCustomer?.id || body?.customerId || null,
      customerName || matchedCustomer?.name || null,
      body?.phone || matchedCustomer?.phone || null,
      body?.email || matchedCustomer?.email || null,
      body?.city || matchedCustomer?.city || null,
      body?.address || matchedCustomer?.address || null,
      title || `Venta · ${customerName || body?.phone || "Cliente"}`,
      Number(body?.value || 0),
      stage,
      String(body?.source || "MANUAL"),
      body?.assignedSellerId || null,
      body?.assignedSellerName || null,
      ["LOW","MEDIUM","HIGH"].includes(String(body?.priority || "")) ? String(body.priority) : "MEDIUM",
      body?.nextAction || null,
      body?.nextAt ? new Date(body.nextAt) : null,
      body?.notes || null,
    );
    await addSalesActivity({ opportunityId: id, type: "CREATED", text: "Oportunidad creada", actorUserId: session.userId, actorName: session.name });
    await writeAudit({ actorUserId: session.userId, actorName: session.name, action: "OPPORTUNITY_CREATED", meta: { opportunityId: id, customerName, stage, value: Number(body?.value || 0) } });
    const item = await getOne(id);
    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    console.error("[OPPORTUNITIES_POST]", error);
    return NextResponse.json({ error: error?.message || "No se pudo crear la oportunidad" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureSalesTables();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const body = await req.json();
    const id = String(body?.id || "");
    if (!id) return NextResponse.json({ error: "Oportunidad requerida" }, { status: 400 });
    const currentRows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Opportunity" WHERE "id"=$1 LIMIT 1`, id);
    const current = currentRows[0];
    if (!current) return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });

    const allowed = ["customerName","phone","email","city","address","title","value","stage","source","assignedSellerId","assignedSellerName","priority","nextAction","nextAt","lossReason","notes"];
    const sets: string[] = [];
    const values: any[] = [id];
    for (const key of allowed) {
      if (body[key] === undefined) continue;
      let value: any = body[key] === "" ? null : body[key];
      if (key === "stage") {
        if (!OPPORTUNITY_STAGES.includes(String(value) as any)) return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
      }
      if (key === "value") value = Number(value || 0);
      if (key === "nextAt") value = value ? new Date(value) : null;
      values.push(value);
      sets.push(`"${key}"=$${values.length}`);
    }
    if (!sets.length) return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

    const nextStage = body.stage ? String(body.stage) : current.stage;
    if (body.stage === "WON") sets.push(`"wonAt"=COALESCE("wonAt",NOW()), "lostAt"=NULL`);
    if (body.stage === "LOST") sets.push(`"lostAt"=COALESCE("lostAt",NOW()), "wonAt"=NULL`);
    if (body.stage && !["WON","LOST"].includes(String(body.stage))) sets.push(`"wonAt"=NULL, "lostAt"=NULL`);
    sets.push(`"updatedAt"=NOW()`);

    await prisma.$executeRawUnsafe(`UPDATE "Opportunity" SET ${sets.join(",")} WHERE "id"=$1`, ...values);

    if (body.stage && current.stage !== body.stage && current.leadId) {
      await prisma.$executeRawUnsafe(`UPDATE "Lead" SET "status"=$2,"updatedAt"=NOW() WHERE "id"=$1`, current.leadId, stageToLead(String(body.stage)));
    }

    const changes: string[] = [];
    if (body.stage && body.stage !== current.stage) changes.push(`Etapa: ${current.stage} → ${body.stage}`);
    if (body.assignedSellerName !== undefined && body.assignedSellerName !== current.assignedSellerName) changes.push(`Responsable: ${body.assignedSellerName || "Sin asignar"}`);
    if (body.value !== undefined && Number(body.value) !== Number(current.value)) changes.push(`Valor actualizado`);
    if (body.nextAction !== undefined || body.nextAt !== undefined) changes.push(`Seguimiento actualizado`);
    if (body.notes !== undefined) changes.push("Notas actualizadas");
    await addSalesActivity({
      opportunityId: id,
      type: body.stage && body.stage !== current.stage ? "STAGE_CHANGED" : "UPDATED",
      text: changes.join(" · ") || "Oportunidad actualizada",
      actorUserId: session.userId,
      actorName: session.name,
      meta: { stage: nextStage },
    });

    if (body.stage === "WON" && current.stage !== "WON") {
      await prisma.notification.create({ data: { type: "opportunity_won", message: `Venta ganada: ${current.customerName || current.title}` } });
    }
    await writeAudit({ actorUserId: session.userId, actorName: session.name, action: "OPPORTUNITY_UPDATED", meta: { opportunityId: id, changes, stage: nextStage } });

    return NextResponse.json(await getOne(id));
  } catch (error: any) {
    console.error("[OPPORTUNITIES_PUT]", error);
    return NextResponse.json({ error: error?.message || "No se pudo actualizar la oportunidad" }, { status: 500 });
  }
}
