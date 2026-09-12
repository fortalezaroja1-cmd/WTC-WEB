import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { ensureCrmTables, saveOutboundWhatsAppMessage } from "@/lib/crm";
import {
  evaluateSalesAgent,
  SALES_AGENT_FOLLOW_UP_HOURS,
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

function labelForAction(decision: AgentDecision) {
  if (decision.action === "REQUEST_CONFIRMATION") return "POR-CONFIRMAR";
  if (decision.action === "QUOTE_PENDING_SHIPPING") return "COTIZACIÓN PENDIENTE";
  if (["QUALIFY", "COLLECT_QUALIFICATION", "CLARIFY_PRODUCT"].includes(decision.action)) return "EN-CALIFICACIÓN";
  if (decision.action === "COLLECT_CLOSE_DATA") return "DATOS DE CIERRE";
  return "ACORDADO";
}

async function persistDecision(leadId: string, decision: AgentDecision) {
  const fallbackNextAt = new Date(Date.now() + SALES_AGENT_FOLLOW_UP_HOURS * 60 * 60 * 1000);
  const nextAt = decision.state.nextStepAt ? new Date(decision.state.nextStepAt) : fallbackNextAt;
  const nextStep = decision.state.nextStep || "Revisar conversación y siguiente paso";
  const stateJson = JSON.stringify(decision.state);

  if (decision.cap === "C") {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "status"=$2, "agentState"=$3::jsonb, "agentLastIntent"=$4,
       "agentConfidence"=$5, "agentNeedsHuman"=$6, "agentLastAction"=$7, "agentLastReplyAt"=NOW(),
       "capPending"=false, "capStep"='C', "capC"=true, "capA"=false, "capP"=false,
       "capDecision"='C', "capLabel"='POR-CERRAR',
       "capNextStep"='Validar envío, crear pedido y programar despacho. No generar guía sin confirmación.',
       "capNextAt"=NULL, "capSequence"=NULL, "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
      leadId, decision.status, stateJson, decision.intent, decision.confidence, decision.needsHuman, decision.action
    );
    return;
  }

  if (decision.cap === "HUMAN") {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "status"=$2, "agentState"=$3::jsonb, "agentLastIntent"=$4,
       "agentConfidence"=$5, "agentNeedsHuman"=true, "agentLastAction"=$6, "agentLastReplyAt"=NOW(),
       "capPending"=false, "capStep"='P', "capC"=false, "capA"=false, "capP"=true,
       "capDecision"='P', "capLabel"='LLAMADA', "capNextStep"='Atención humana requerida por el agente',
       "capNextAt"=NOW(), "capSequence"='CALL', "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
      leadId, decision.status, stateJson, decision.intent, decision.confidence, decision.action
    );
    return;
  }

  if (decision.cap === "A") {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "status"=$2, "agentState"=$3::jsonb, "agentLastIntent"=$4,
       "agentConfidence"=$5, "agentNeedsHuman"=$6, "agentLastAction"=$7, "agentLastReplyAt"=NOW(),
       "capPending"=false, "capStep"='A', "capC"=false, "capA"=true, "capP"=false,
       "capDecision"='A', "capLabel"=$8, "capNextStep"=$9, "capNextAt"=$10,
       "capSequence"='WAITING_CLIENT', "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
      leadId, decision.status, stateJson, decision.intent, decision.confidence, decision.needsHuman,
      decision.action, labelForAction(decision), nextStep, nextAt
    );
    return;
  }

  if (decision.cap === "P") {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "status"=$2, "agentState"=$3::jsonb, "agentLastIntent"=$4,
       "agentConfidence"=$5, "agentNeedsHuman"=$6, "agentLastAction"=$7, "agentLastReplyAt"=NOW(),
       "capPending"=false, "capStep"='P', "capC"=false, "capA"=false, "capP"=true,
       "capDecision"='P', "capLabel"='SEGUIMIENTO', "capNextStep"=$8, "capNextAt"=$9,
       "capSequence"='MESSAGE', "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
      leadId, decision.status, stateJson, decision.intent, decision.confidence, decision.needsHuman,
      decision.action, nextStep, nextAt
    );
    return;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "Lead" SET "status"=$2, "agentState"=$3::jsonb, "agentLastIntent"=$4,
     "agentConfidence"=$5, "agentNeedsHuman"=$6, "agentLastAction"=$7, "agentLastReplyAt"=NOW(),
     "capPending"=false, "capDecision"=CASE WHEN $2='LOST' THEN 'LOST' ELSE "capDecision" END,
     "capLabel"=CASE WHEN $2='LOST' THEN 'PERDIDO' ELSE "capLabel" END,
     "capNextAt"=NULL, "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
    leadId, decision.status, stateJson, decision.intent, decision.confidence, decision.needsHuman, decision.action
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
  const { decision } = await evaluateSalesAgent({ text: input.text, state: prior, lead });

  if (input.source === "META_TEST") {
    await persistDecision(input.leadId, { ...decision, needsHuman: true, action: `DRY_RUN_${decision.action}` });
    await addActivity(input.leadId, `Agente (prueba): ${decision.action}`, {
      version: SALES_AGENT_VERSION, intent: decision.intent, reply: decision.reply, state: decision.state,
      candidates: decision.candidates, missingFields: decision.missingFields,
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
      candidates: decision.candidates,
      missingFields: decision.missingFields,
    });

    if (decision.needsHuman || decision.cap === "C") {
      await prisma.notification.create({
        data: {
          type: decision.cap === "C" ? "crm_ready_to_close" : "crm_agent_handoff",
          message: decision.cap === "C"
            ? `${lead.name || lead.phone || "Lead"} quedó POR CERRAR · validar envío y programación`
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
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "Lead" SET "status"=$2, "agentLastAction"='SYSTEM_STAGE_SYNC', "agentNeedsHuman"=false, "updatedAt"=NOW()
     WHERE regexp_replace(COALESCE("phone", ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g') RETURNING "id"`,
    phone, status
  );
  for (const row of rows) await addActivity(row.id, reason, { version: SALES_AGENT_VERSION, status, source: "ORDER_SYNC" });
  return rows.length;
}
