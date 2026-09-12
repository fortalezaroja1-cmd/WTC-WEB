import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { ensureAgentColumns, sendAgentWhatsAppText } from "@/lib/sales-agent";
import { isBusinessOpen, loadBusinessHours } from "@/lib/business-hours";
import { SALES_AGENT_VERSION, type SalesAgentState } from "@/lib/sales-agent-core";

const FOLLOW_UP_DELAY_HOURS = 24;

function nextAt(hours = FOLLOW_UP_DELAY_HOURS) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function followupState(raw: unknown): SalesAgentState {
  return raw && typeof raw === "object" ? raw as SalesAgentState : {};
}

async function activity(leadId: string, text: string, meta: unknown) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CrmActivity" ("id", "leadId", "type", "text", "meta", "createdAt")
     VALUES ($1, $2, 'FOLLOW_UP', $3, $4::jsonb, NOW())`,
    randomUUID(), leadId, text, JSON.stringify(meta ?? {})
  );
}

async function saveFollowupState(leadId: string, state: SalesAgentState, input: {
  label: string;
  nextStep: string;
  nextAt: Date | null;
  sequence: string;
  needsHuman?: boolean;
  action: string;
}) {
  await prisma.$executeRawUnsafe(
    `UPDATE "Lead" SET
      "agentState"=$2::jsonb,
      "agentLastAction"=$3,
      "agentNeedsHuman"=$4,
      "capPending"=false,
      "capStep"='P', "capC"=false, "capA"=false, "capP"=true,
      "capDecision"='P', "capLabel"=$5, "capNextStep"=$6, "capNextAt"=$7,
      "capSequence"=$8, "capCompletedAt"=NOW(), "updatedAt"=NOW()
     WHERE "id"=$1`,
    leadId, JSON.stringify(state), input.action, input.needsHuman === true,
    input.label, input.nextStep, input.nextAt, input.sequence
  );
}

export async function runSalesFollowups() {
  await ensureAgentColumns();
  const hours = await loadBusinessHours();
  if (!isBusinessOpen(hours)) {
    return { ok: true, skipped: "OUTSIDE_BUSINESS_HOURS", processed: 0, actions: [] as any[] };
  }

  const leads = await prisma.$queryRawUnsafe<any[]>(`
    SELECT * FROM "Lead"
    WHERE "agentEnabled" = true
      AND "capNextAt" IS NOT NULL
      AND "capNextAt" <= NOW()
      AND COALESCE("capDecision", '') IN ('A', 'P')
      AND "status" NOT IN ('CLOSED', 'DELIVERED', 'LOST')
      AND "lastOutboundAt" IS NOT NULL
      AND ("lastInboundAt" IS NULL OR "lastInboundAt" <= "lastOutboundAt")
    ORDER BY "capNextAt" ASC
    LIMIT 100
  `);

  const actions: Array<{ leadId: string; action: string }> = [];

  for (const lead of leads) {
    const currentState = followupState(lead.agentState);
    // Una interacción nueva vuelve a A y reinicia la secuencia. P conserva el contador.
    const attempt = String(lead.capDecision) === "A" ? 0 : Number(currentState.followUpAttempt || 0);

    try {
      if (attempt <= 0) {
        const text = "Quedo pendiente de tu respuesta para continuar con el pedido. Si todavía lo necesitas, respóndeme por aquí y retomamos desde donde quedamos.";
        await sendAgentWhatsAppText(lead, text, "AGENT");
        const state = { ...currentState, followUpAttempt: 1, nextStep: "Si no responde, llamar al cliente", nextStepAt: nextAt().toISOString() };
        await saveFollowupState(lead.id, state, {
          label: "SEGUIMIENTO 1", nextStep: "Llamar al cliente si continúa sin respuesta", nextAt: nextAt(),
          sequence: "MESSAGE_1", action: "FOLLOWUP_MESSAGE_1",
        });
        await activity(lead.id, "Seguimiento 1 enviado por WhatsApp", { version: SALES_AGENT_VERSION, attempt: 1 });
        actions.push({ leadId: lead.id, action: "MESSAGE_1" });
        continue;
      }

      if (attempt === 1) {
        const state = { ...currentState, followUpAttempt: 2, nextStep: "Realizar llamada; si no hay contacto, enviar último mensaje", nextStepAt: nextAt().toISOString() };
        await saveFollowupState(lead.id, state, {
          label: "LLAMADA", nextStep: "Llamar al cliente por falta de respuesta", nextAt: nextAt(),
          sequence: "CALL", needsHuman: true, action: "FOLLOWUP_CALL",
        });
        await prisma.notification.create({
          data: {
            type: "crm_call_due",
            message: `Llamar a ${lead.name || lead.phone || "cliente"}: segundo intento de seguimiento${lead.assignedSellerName ? ` · ${lead.assignedSellerName}` : ""}`,
          },
        });
        await activity(lead.id, "Seguimiento 2: llamada requerida", { version: SALES_AGENT_VERSION, attempt: 2 });
        actions.push({ leadId: lead.id, action: "CALL" });
        continue;
      }

      if (attempt === 2) {
        const text = "Te escribo por última vez para no insistir. Si todavía necesitas el material, respóndeme por este chat y retomamos tu pedido.";
        await sendAgentWhatsAppText(lead, text, "AGENT");
        const state = { ...currentState, followUpAttempt: 3, nextStep: "Sin más seguimiento automático", nextStepAt: undefined };
        await saveFollowupState(lead.id, state, {
          label: "ÚLTIMO MENSAJE", nextStep: "Sin más seguimiento automático", nextAt: null,
          sequence: "FINAL_MESSAGE", action: "FOLLOWUP_FINAL_MESSAGE",
        });
        await activity(lead.id, "Seguimiento 3: último mensaje enviado", { version: SALES_AGENT_VERSION, attempt: 3 });
        actions.push({ leadId: lead.id, action: "FINAL_MESSAGE" });
        continue;
      }

      await saveFollowupState(lead.id, currentState, {
        label: "SEGUIMIENTO FINALIZADO", nextStep: "Sin más seguimiento automático", nextAt: null,
        sequence: "DONE", action: "FOLLOWUP_DONE",
      });
      actions.push({ leadId: lead.id, action: "DONE" });
    } catch (error: any) {
      await activity(lead.id, "Error en seguimiento automático", { version: SALES_AGENT_VERSION, error: error?.message || String(error) });
      await prisma.notification.create({
        data: { type: "crm_followup_error", message: `No se pudo ejecutar seguimiento de ${lead.name || lead.phone || "lead"}: ${error?.message || "error"}` },
      });
      actions.push({ leadId: lead.id, action: "ERROR" });
    }
  }

  return { ok: true, processed: actions.length, actions };
}
