import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { addSalesActivity, ensureSalesTables, OPPORTUNITY_STAGES, syncOpportunitiesFromLeads } from "@/lib/sales-system";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const CAP_STEPS = ["ENTRY","CONTACT","QUALIFY","DIAGNOSE","PROPOSE","FOLLOW_UP","DECISION","CLOSED"] as const;
const ACTIVE_STAGES = new Set(["NEW","CONTACTED","QUOTED","NEGOTIATION"]);

function capStageForStep(step: string) {
  if (step === "CONTACT" || step === "QUALIFY") return "NEW";
  if (step === "DIAGNOSE" || step === "PROPOSE") return "CONTACTED";
  if (step === "FOLLOW_UP") return "QUOTED";
  if (step === "DECISION") return "NEGOTIATION";
  return "NEW";
}

function nextCapStep(step: string) {
  const i = CAP_STEPS.indexOf(step as any);
  if (i < 0 || i >= CAP_STEPS.length - 2) return step;
  return CAP_STEPS[i + 1];
}

function parseJsonValue(value: any, fallback: any) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

function missingForCap(step: string, item: any, quoteCount: number) {
  const missing: string[] = [];
  const answers = parseJsonValue(item.capAnswers, {});
  const evidence = parseJsonValue(item.capEvidence, []);
  if (!item.assignedSellerId) missing.push("responsable");
  if (step === "ENTRY") {
    if (!item.nextAction) missing.push("próxima acción");
    if (!item.nextAt) missing.push("fecha de próxima acción");
  }
  if (step === "CONTACT") {
    if (!Array.isArray(evidence) || evidence.length === 0) missing.push("evidencia de contacto");
  }
  if (step === "QUALIFY") {
    for (const key of ["need","objective","problem","budget","urgency","decisionMaker"]) if (!String(answers?.[key] || "").trim()) missing.push(key);
    if (!["QUALIFIES","NO_QUALIFIES","MISSING_INFO"].includes(String(item.qualificationDecision || ""))) missing.push("decisión de calificación");
  }
  if (step === "DIAGNOSE") {
    if (!String(answers?.diagnosis || "").trim()) missing.push("diagnóstico");
    if (!String(answers?.bottleneck || "").trim()) missing.push("cuello de botella");
  }
  if (step === "PROPOSE" && quoteCount < 1) missing.push("cotización");
  if (step === "FOLLOW_UP") {
    if (!item.nextAction) missing.push("próxima acción");
    if (!item.nextAt) missing.push("fecha de próxima acción");
  }
  return missing;
}

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
      body?.assignedSellerId || session.userId,
      body?.assignedSellerName || session.name,
      ["LOW","MEDIUM","HIGH"].includes(String(body?.priority || "")) ? String(body.priority) : "MEDIUM",
      body?.nextAction || "Realizar contacto inicial",
      body?.nextAt ? new Date(body.nextAt) : new Date(Date.now() + 60 * 60 * 1000),
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

    let bodyForUpdate = { ...body };
    if (body?.advanceCap) {
      const quoteRows = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS count FROM "Quote" WHERE "opportunityId"=$1`, id);
      const merged = {
        ...current,
        ...body,
        capAnswers: body.capAnswers !== undefined ? body.capAnswers : current.capAnswers,
        capEvidence: body.capEvidence !== undefined ? body.capEvidence : current.capEvidence,
      };
      const step = String(current.capStep || "ENTRY");
      const missing = missingForCap(step, merged, Number(quoteRows[0]?.count || 0));
      if (missing.length) {
        await prisma.$executeRawUnsafe(
          `UPDATE "Opportunity" SET "capMissingFields"=$2::jsonb,"capBlockedReason"=$3,"updatedAt"=NOW() WHERE "id"=$1`,
          id, JSON.stringify(missing), `Falta completar: ${missing.join(", ")}`
        );
        return NextResponse.json({ error: `NO LISTO · Falta: ${missing.join(", ")}`, missing }, { status: 409 });
      }
      const next = nextCapStep(step);
      bodyForUpdate = {
        ...bodyForUpdate,
        capStep: next,
        capSequence: Number(current.capSequence || 1) + 1,
        capMissingFields: [],
        capBlockedReason: null,
        stage: capStageForStep(next),
      };
    }

    if (body?.stage && body.stage !== current.stage && !body?.advanceCap && !["WON","LOST"].includes(String(body.stage))) {
      return NextResponse.json({ error: "La etapa comercial se mueve completando CAP, no manualmente." }, { status: 409 });
    }
    if (body?.stage === "LOST" && !String(body?.lossReason || current.lossReason || "").trim()) {
      return NextResponse.json({ error: "Para cerrar como perdido debes registrar el motivo." }, { status: 409 });
    }
    if (body?.stage === "WON") {
      const quoteRows = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS count FROM "Quote" WHERE "opportunityId"=$1`, id);
      if (Number(quoteRows[0]?.count || 0) < 1) return NextResponse.json({ error: "Para cerrar como ganado debe existir al menos una cotización." }, { status: 409 });
      if (!current.assignedSellerId && !body?.assignedSellerId) return NextResponse.json({ error: "Asigna un responsable antes de cerrar." }, { status: 409 });
      bodyForUpdate.capStep = "CLOSED";
      bodyForUpdate.capCompletedAt = new Date();
      bodyForUpdate.capDecision = "WON";
    }
    if (body?.stage === "LOST") {
      bodyForUpdate.capStep = "CLOSED";
      bodyForUpdate.capCompletedAt = new Date();
      bodyForUpdate.capDecision = "LOST";
    }

    const allowed = ["customerName","phone","email","city","address","title","value","stage","source","assignedSellerId","assignedSellerName","priority","nextAction","nextAt","lossReason","notes","capStep","capDecision","capLabel","capSequence","capAnswers","capEvidence","capMissingFields","capBlockedReason","capCompletedAt","qualificationDecision"];
    const sets: string[] = [];
    const values: any[] = [id];
    for (const key of allowed) {
      if (bodyForUpdate[key] === undefined) continue;
      let value: any = bodyForUpdate[key] === "" ? null : bodyForUpdate[key];
      if (key === "stage") {
        if (!OPPORTUNITY_STAGES.includes(String(value) as any)) return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
      }
      if (key === "capStep" && !CAP_STEPS.includes(String(value) as any)) return NextResponse.json({ error: "Paso CAP inválido" }, { status: 400 });
      if (key === "value") value = Number(value || 0);
      if (key === "nextAt") value = value ? new Date(value) : null;
      const jsonKey = ["capAnswers","capEvidence","capMissingFields"].includes(key);
      if (jsonKey) value = JSON.stringify(value ?? (key === "capAnswers" ? {} : []));
      values.push(value);
      sets.push(jsonKey ? `"${key}"=${values.length}::jsonb` : `"${key}"=${values.length}`);
    }
    if (!sets.length) return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

    const nextStage = bodyForUpdate.stage ? String(bodyForUpdate.stage) : current.stage;
    if (bodyForUpdate.stage === "WON") sets.push(`"wonAt"=COALESCE("wonAt",NOW()), "lostAt"=NULL`);
    if (bodyForUpdate.stage === "LOST") sets.push(`"lostAt"=COALESCE("lostAt",NOW()), "wonAt"=NULL`);
    if (bodyForUpdate.stage && !["WON","LOST"].includes(String(bodyForUpdate.stage))) sets.push(`"wonAt"=NULL, "lostAt"=NULL`);
    sets.push(`"updatedAt"=NOW()`);

    await prisma.$executeRawUnsafe(`UPDATE "Opportunity" SET ${sets.join(",")} WHERE "id"=$1`, ...values);

    if (bodyForUpdate.stage && current.stage !== bodyForUpdate.stage && current.leadId) {
      await prisma.$executeRawUnsafe(`UPDATE "Lead" SET "status"=$2,"updatedAt"=NOW() WHERE "id"=$1`, current.leadId, stageToLead(String(bodyForUpdate.stage)));
    }

    const changes: string[] = [];
    if (bodyForUpdate.stage && bodyForUpdate.stage !== current.stage) changes.push(`Etapa: ${current.stage} → ${bodyForUpdate.stage}`);
    if (body.assignedSellerName !== undefined && body.assignedSellerName !== current.assignedSellerName) changes.push(`Responsable: ${body.assignedSellerName || "Sin asignar"}`);
    if (body.value !== undefined && Number(body.value) !== Number(current.value)) changes.push(`Valor actualizado`);
    if (body.nextAction !== undefined || body.nextAt !== undefined) changes.push(`Seguimiento actualizado`);
    if (body.notes !== undefined) changes.push("Notas actualizadas");
    await addSalesActivity({
      opportunityId: id,
      type: bodyForUpdate.stage && bodyForUpdate.stage !== current.stage ? "STAGE_CHANGED" : "UPDATED",
      text: changes.join(" · ") || "Oportunidad actualizada",
      actorUserId: session.userId,
      actorName: session.name,
      meta: { stage: nextStage },
    });

    if (bodyForUpdate.stage === "WON" && current.stage !== "WON") {
      await prisma.notification.create({ data: { type: "opportunity_won", message: `Venta ganada: ${current.customerName || current.title}` } });
    }
    await writeAudit({ actorUserId: session.userId, actorName: session.name, action: "OPPORTUNITY_UPDATED", meta: { opportunityId: id, changes, stage: nextStage } });

    return NextResponse.json(await getOne(id));
  } catch (error: any) {
    console.error("[OPPORTUNITIES_PUT]", error);
    return NextResponse.json({ error: error?.message || "No se pudo actualizar la oportunidad" }, { status: 500 });
  }
}
