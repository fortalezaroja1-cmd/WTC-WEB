import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { ensureCrmTables, saveOutboundWhatsAppMessage } from "@/lib/crm";
import { enrichAgentTextFromContext } from "@/lib/sales-agent-context";
import { enforceOriginalSalesStrategy, type StrategicDecision } from "@/lib/sales-strategy-enforcer";
import {
  evaluateSalesAgent,
  SALES_AGENT_VERSION,
  type AgentDecision,
  type SalesAgentState,
} from "@/lib/sales-agent-core";

let agentTablesReady: Promise<void> | null = null;

export async function ensureAgentColumns() {
  await ensureCrmTables();
  if (!agentTablesReady) {
    agentTablesReady = (async () => {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "agentEnabled" BOOLEAN NOT NULL DEFAULT true`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "agentState" JSONB NOT NULL DEFAULT '{}'::jsonb`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "agentLastIntent" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "agentConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "agentNeedsHuman" BOOLEAN NOT NULL DEFAULT false`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "agentLastAction" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "agentLastReplyAt" TIMESTAMP(3)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "agentLastInboundId" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "commercialStage" TEXT NOT NULL DEFAULT 'NUEVO'`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "timeLabel" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "followUpMode" TEXT`);
    })().catch((error) => {
      agentTablesReady = null;
      throw error;
    });
  }
  return agentTablesReady;
}

async function addActivity(leadId: string, text: string, meta: unknown) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CrmActivity" ("id", "leadId", "type", "text", "meta", "createdAt") VALUES ($1, $2, 'AGENT', $3, $4::jsonb, NOW())`,
    randomUUID(), leadId, text, JSON.stringify(meta ?? {})
  );
}

export async function sendAgentWhatsAppText(lead: any, text: string, senderType: "AGENT" | "SYSTEM" = "AGENT") {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("META_WHATSAPP_ACCESS_TOKEN no configurado");

  const metadataRows = await prisma.$queryRawUnsafe<Array<{ phoneNumberId: string | null }>>(
    `SELECT "payload"->'value'->'metadata'->>'phone_number_id' AS "phoneNumberId"
     FROM "CrmMessage"
     WHERE "leadId" = $1 AND "direction" = 'INBOUND'
     ORDER BY "sentAt" DESC, "createdAt" DESC LIMIT 1`,
    lead.id
  );
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID || metadataRows[0]?.phoneNumberId;
  if (!phoneNumberId) throw new Error("META_WHATSAPP_PHONE_NUMBER_ID no disponible");

  const graphVersion = process.env.META_GRAPH_VERSION || "v26.0";
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: lead.whatsappId,
      type: "text",
      text: { preview_url: false, body: text.slice(0, 4096) },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "Meta rechazó la respuesta del agente");
  const metaMessageId = payload?.messages?.[0]?.id;
  if (!metaMessageId) throw new Error("Meta no devolvió ID del mensaje del agente");

  await saveOutboundWhatsAppMessage({
    leadId: lead.id,
    metaMessageId: String(metaMessageId),
    text,
    payload,
    senderType,
  });
  return String(metaMessageId);
}

async function persistDecision(leadId: string, decision: StrategicDecision | AgentDecision) {
  const strategic = decision as StrategicDecision;
  const stage = strategic.commercialStage || (decision.state as any)?.commercialStage || "EN-CALIFICACIÓN";
  const timeLabel = strategic.timeLabel ?? (decision.state as any)?.timeLabel ?? null;
  const followUpMode = strategic.followUpMode ?? (decision.state as any)?.followUpMode ?? null;
  const nextStep = decision.state.nextStep || "Revisar conversación y siguiente paso";
  const nextAt = decision.state.nextStepAt ? new Date(decision.state.nextStepAt) : null;
  const stateJson = JSON.stringify(decision.state);

  await prisma.$executeRawUnsafe(
    `UPDATE "Lead" SET
      "status"=$2, "agentState"=$3::jsonb, "agentLastIntent"=$4, "agentConfidence"=$5,
      "agentNeedsHuman"=$6, "agentLastAction"=$7, "agentLastReplyAt"=NOW(),
      "commercialStage"=$8, "timeLabel"=$9, "followUpMode"=$10, "updatedAt"=NOW()
     WHERE "id"=$1`,
    leadId, decision.status, stateJson, decision.intent, decision.confidence, decision.needsHuman,
    decision.action, stage, timeLabel, followUpMode
  );

  if (decision.cap === "C") {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "capPending"=false, "capStep"='C', "capC"=true, "capA"=false, "capP"=false,
       "capDecision"='C', "capLabel"='CERRAR', "capNextStep"=$2, "capNextAt"=$3,
       "capSequence"='CLOSE', "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
      leadId, nextStep, nextAt
    );
    return;
  }

  if (decision.cap === "A") {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "capPending"=false, "capStep"='A', "capC"=false, "capA"=true, "capP"=false,
       "capDecision"='A', "capLabel"='ACORDAR', "capNextStep"=$2, "capNextAt"=$3,
       "capSequence"='AGREED', "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
      leadId, nextStep, nextAt
    );
    return;
  }

  // P = Planear. Incluye seguimiento, casos humanos y terminal PERDIDO.
  await prisma.$executeRawUnsafe(
    `UPDATE "Lead" SET "capPending"=false, "capStep"='P', "capC"=false, "capA"=false, "capP"=true,
     "capDecision"='P', "capLabel"='PLANEAR', "capNextStep"=$2, "capNextAt"=$3,
     "capSequence"=$4, "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
    leadId, nextStep, nextAt, followUpMode || (stage === "PERDIDO" ? "DONE" : "PLAN")
  );
}

export async function processInboundLeadWithAgent(input: { leadId: string; metaMessageId: string; text: string | null; source?: string }) {
  if (String(process.env.CRM_AGENT_ENABLED || "true").toLowerCase() === "false") return { skipped: "GLOBAL_DISABLED" };
  if (!input.text || input.text.startsWith("[")) return { skipped: "NON_TEXT" };

  await ensureAgentColumns();
  const leads = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Lead" WHERE "id"=$1 LIMIT 1`, input.leadId);
  const lead = leads[0];
  if (!lead || lead.agentEnabled === false) return { skipped: "LEAD_DISABLED" };

  const claimed = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "Lead" SET "agentLastInboundId"=$2, "updatedAt"=NOW()
     WHERE "id"=$1 AND COALESCE("agentLastInboundId", '') <> $2 RETURNING "id"`,
    input.leadId, input.metaMessageId
  );
  if (!claimed.length) return { skipped: "ALREADY_PROCESSED" };

  const prior: SalesAgentState = lead.agentState && typeof lead.agentState === "object" ? lead.agentState : {};
  const effectiveText = enrichAgentTextFromContext(input.text, prior);
  const evaluated = await evaluateSalesAgent({ text: effectiveText, state: prior, lead });
  const decision = await enforceOriginalSalesStrategy(input.text, evaluated.decision);

  if (input.source === "META_TEST") {
    const dryDecision = { ...decision, needsHuman: true, action: `DRY_RUN_${decision.action}` } as StrategicDecision;
    await persistDecision(input.leadId, dryDecision);
    await addActivity(input.leadId, `Agente (prueba): ${decision.action}`, {
      version: SALES_AGENT_VERSION,
      intent: decision.intent,
      reply: decision.reply,
      state: decision.state,
      commercialStage: decision.commercialStage,
      timeLabel: decision.timeLabel,
      followUpMode: decision.followUpMode,
      originalText: input.text,
      effectiveText,
      candidates: decision.candidates,
      missingFields: decision.missingFields,
    });
    return { ok: true, dryRun: true, decision };
  }

  try {
    await sendAgentWhatsAppText(lead, decision.reply, "AGENT");
    await persistDecision(input.leadId, decision);
    await addActivity(input.leadId, `Agente: ${decision.action}`, {
      version: SALES_AGENT_VERSION,
      intent: decision.intent,
      confidence: decision.confidence,
      state: decision.state,
      commercialStage: decision.commercialStage,
      timeLabel: decision.timeLabel,
      followUpMode: decision.followUpMode,
      originalText: input.text,
      effectiveText,
      candidates: decision.candidates,
      missingFields: decision.missingFields,
    });

    if (decision.needsHuman || decision.cap === "C") {
      await prisma.notification.create({
        data: {
          type: decision.cap === "C" ? "crm_ready_to_close" : "crm_agent_handoff",
          message: decision.cap === "C"
            ? `${lead.name || lead.phone || "Lead"} está en CERRAR · ${decision.state.nextStep || "revisar cierre"}`
            : `${lead.name || lead.phone || "Lead"} requiere atención humana · ${decision.action}`,
        },
      });
    }
    return { ok: true, decision };
  } catch (error: any) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "agentNeedsHuman"=true, "agentLastAction"='SEND_ERROR', "updatedAt"=NOW() WHERE "id"=$1`,
      input.leadId
    );
    await addActivity(input.leadId, "Agente: error enviando respuesta", {
      version: SALES_AGENT_VERSION, error: error?.message || String(error),
    });
    await prisma.notification.create({
      data: { type: "crm_agent_error", message: `Agente no pudo responder a ${lead.name || lead.phone || "lead"}: ${error?.message || "error"}` },
    });
    throw error;
  }
}

export async function syncLeadStageByPhone(phone: string | null | undefined, status: "SCHEDULED" | "DELIVERED" | "CLOSED" | "LOST", reason: string) {
  if (!phone) return null;
  await ensureAgentColumns();
  const commercialStage = status === "DELIVERED" || status === "CLOSED" ? "VENDIDO" : status === "LOST" ? "PERDIDO" : "POR-CERRAR";
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "Lead" SET "status"=$2, "commercialStage"=$3, "agentLastAction"='SYSTEM_STAGE_SYNC',
     "agentNeedsHuman"=false, "timeLabel"=NULL, "updatedAt"=NOW()
     WHERE regexp_replace(COALESCE("phone", ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g') RETURNING "id"`,
    phone, status, commercialStage
  );
  for (const row of rows) await addActivity(row.id, reason, { version: SALES_AGENT_VERSION, status, commercialStage, source: "ORDER_SYNC" });
  return rows.length;
}
