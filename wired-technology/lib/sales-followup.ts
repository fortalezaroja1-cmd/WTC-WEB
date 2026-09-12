import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { ensureAgentColumns, sendAgentWhatsAppText } from "@/lib/sales-agent";
import { isBusinessOpen, loadBusinessHours } from "@/lib/business-hours";
import { SALES_AGENT_VERSION, type SalesAgentState } from "@/lib/sales-agent-core";

type FollowUpMode = "QUALIFICATION" | "QUOTED" | "AGREED_DATE" | "COMPARING" | "LATER" | "CALL_REQUEST" | "HUMAN";
type ExtendedState = SalesAgentState & { followUpAttempt?: number; followUpMode?: FollowUpMode };

function nextAt(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function followupState(raw: unknown): ExtendedState {
  return raw && typeof raw === "object" ? raw as ExtendedState : {};
}

function callWindowOpen(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota", weekday: "short", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value || "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  if (weekday === "Sun") return false;
  if (weekday === "Sat") return hour >= 8 && hour < 12;
  return hour >= 8 && hour < 17;
}

async function activity(leadId: string, text: string, meta: unknown) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CrmActivity" ("id", "leadId", "type", "text", "meta", "createdAt")
     VALUES ($1, $2, 'FOLLOW_UP', $3, $4::jsonb, NOW())`,
    randomUUID(), leadId, text, JSON.stringify(meta ?? {})
  );
}

async function savePlan(leadId: string, state: ExtendedState, input: {
  stage?: string;
  timeLabel?: string | null;
  capLabel?: string;
  nextStep: string;
  nextAt: Date | null;
  sequence: string;
  needsHuman?: boolean;
  action: string;
  followUpMode?: FollowUpMode | null;
}) {
  const mode = input.followUpMode === undefined ? state.followUpMode || null : input.followUpMode;
  const stage = input.stage || "SEGUIMIENTO";
  const nextState = { ...state, followUpMode: mode || undefined };
  await prisma.$executeRawUnsafe(
    `UPDATE "Lead" SET
      "agentState"=$2::jsonb, "agentLastAction"=$3, "agentNeedsHuman"=$4,
      "commercialStage"=$5, "timeLabel"=$6, "followUpMode"=$7,
      "capPending"=false, "capStep"='P', "capC"=false, "capA"=false, "capP"=true,
      "capDecision"='P', "capLabel"=$8, "capNextStep"=$9, "capNextAt"=$10,
      "capSequence"=$11, "capCompletedAt"=NOW(), "updatedAt"=NOW()
     WHERE "id"=$1`,
    leadId, JSON.stringify(nextState), input.action, input.needsHuman === true,
    stage, input.timeLabel ?? null, mode, input.capLabel || "PLANEAR",
    input.nextStep, input.nextAt, input.sequence
  );
}

async function markLost(lead: any, state: ExtendedState, reason: string) {
  const nextState = { ...state, followUpAttempt: Math.max(3, Number(state.followUpAttempt || 0)), nextStep: "Sin más seguimiento", nextStepAt: undefined };
  await prisma.$executeRawUnsafe(
    `UPDATE "Lead" SET "status"='LOST', "commercialStage"='PERDIDO', "timeLabel"=NULL,
     "followUpMode"=NULL, "agentState"=$2::jsonb, "agentLastAction"='FOLLOWUP_LOST',
     "agentNeedsHuman"=false, "capPending"=false, "capStep"='P', "capC"=false, "capA"=false,
     "capP"=true, "capDecision"='P', "capLabel"='PLANEAR', "capNextStep"=$3,
     "capNextAt"=NULL, "capSequence"='DONE', "capCompletedAt"=NOW(), "updatedAt"=NOW()
     WHERE "id"=$1`,
    lead.id, JSON.stringify(nextState), reason
  );
  await activity(lead.id, `PERDIDO · ${reason}`, { version: SALES_AGENT_VERSION, reason });
}

async function createCallTask(lead: any, state: ExtendedState, sequence: string, attempt: number) {
  if (!callWindowOpen()) return false;
  const nextState = { ...state, followUpAttempt: attempt, nextStep: "Realizar llamada de seguimiento", nextStepAt: undefined };
  await savePlan(lead.id, nextState, {
    stage: "SEGUIMIENTO", timeLabel: "HOY", capLabel: "LLAMADA",
    nextStep: "Llamar al cliente. Registrar si contestó o no contestó.", nextAt: null,
    sequence, needsHuman: true, action: "FOLLOWUP_CALL", followUpMode: state.followUpMode || "QUOTED",
  });
  await prisma.notification.create({
    data: {
      type: "crm_call_due",
      message: `Llamar a ${lead.name || lead.phone || "cliente"}${lead.assignedSellerName ? ` · ${lead.assignedSellerName}` : ""}`,
    },
  });
  await activity(lead.id, "Seguimiento: llamada requerida", { version: SALES_AGENT_VERSION, attempt, sequence, mode: state.followUpMode });
  return true;
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
      AND COALESCE("commercialStage", 'NUEVO') NOT IN ('VENDIDO', 'PERDIDO')
      AND "status" NOT IN ('CLOSED', 'DELIVERED', 'LOST')
      AND "lastOutboundAt" IS NOT NULL
      AND ("lastInboundAt" IS NULL OR "lastInboundAt" <= "lastOutboundAt")
    ORDER BY "capNextAt" ASC
    LIMIT 100
  `);

  const actions: Array<{ leadId: string; action: string }> = [];

  for (const lead of leads) {
    const state = followupState(lead.agentState);
    const mode = (lead.followUpMode || state.followUpMode || "QUALIFICATION") as FollowUpMode;
    const attempt = Number(state.followUpAttempt || 0);
    state.followUpMode = mode;

    try {
      if (mode === "HUMAN") {
        await savePlan(lead.id, state, {
          stage: lead.commercialStage || "SEGUIMIENTO", timeLabel: "HOY", capLabel: "PLANEAR",
          nextStep: "Atención humana pendiente", nextAt: null, sequence: "HUMAN",
          needsHuman: true, action: "HUMAN_PENDING", followUpMode: "HUMAN",
        });
        await prisma.notification.create({ data: { type: "crm_agent_handoff", message: `${lead.name || lead.phone || "Lead"} requiere atención humana` } });
        actions.push({ leadId: lead.id, action: "HUMAN_PENDING" });
        continue;
      }

      if (mode === "CALL_REQUEST") {
        if (attempt <= 0) {
          const created = await createCallTask(lead, state, "CALL_REQUEST_1", 1);
          if (created) actions.push({ leadId: lead.id, action: "CALL_REQUEST_1" });
          continue;
        }
        if (attempt === 1) {
          const created = await createCallTask(lead, state, "CALL_REQUEST_2", 2);
          if (created) actions.push({ leadId: lead.id, action: "CALL_REQUEST_2" });
          continue;
        }
        if (attempt === 2) {
          const text = "Te he intentado llamar. ¿A qué hora te queda bien que te contactemos?";
          await sendAgentWhatsAppText(lead, text, "AGENT");
          const nextState = { ...state, followUpAttempt: 3, nextStep: "Si no responde, marcar PERDIDO", nextStepAt: nextAt(24).toISOString() };
          await savePlan(lead.id, nextState, {
            stage: "SEGUIMIENTO", timeLabel: "MAÑANA", capLabel: "PLANEAR",
            nextStep: "Si no responde al mensaje después de 2 llamadas, marcar PERDIDO", nextAt: nextAt(24),
            sequence: "CALL_REQUEST_FINAL_MESSAGE", action: "CALL_REQUEST_FINAL_MESSAGE", followUpMode: mode,
          });
          actions.push({ leadId: lead.id, action: "CALL_REQUEST_FINAL_MESSAGE" });
          continue;
        }
        await markLost(lead, state, "Sin respuesta a dos llamadas y mensaje final");
        actions.push({ leadId: lead.id, action: "LOST" });
        continue;
      }

      if (mode === "QUALIFICATION") {
        if (attempt <= 0) {
          const text = "Quedo pendiente de los datos para poder cotizarte: referencia/calibre, cantidad, ciudad/departamento y para cuándo lo necesitas.";
          await sendAgentWhatsAppText(lead, text, "AGENT");
          const nextState = { ...state, followUpAttempt: 1, nextStep: "Último recordatorio de calificación", nextStepAt: nextAt(48).toISOString() };
          await savePlan(lead.id, nextState, {
            stage: "EN-CALIFICACIÓN", timeLabel: "ESTA-SEMANA", nextStep: "Último recordatorio de calificación", nextAt: nextAt(48),
            sequence: "QUALIFICATION_MESSAGE_1", action: "QUALIFICATION_FOLLOWUP_1", followUpMode: mode,
          });
          actions.push({ leadId: lead.id, action: "QUALIFICATION_MESSAGE_1" });
          continue;
        }
        if (attempt === 1) {
          const text = "¿Todavía necesitas la cotización? Si me confirmas los datos del pedido, la retomamos por aquí.";
          await sendAgentWhatsAppText(lead, text, "AGENT");
          const nextState = { ...state, followUpAttempt: 2, nextStep: "Si no responde, marcar PERDIDO", nextStepAt: nextAt(48).toISOString() };
          await savePlan(lead.id, nextState, {
            stage: "EN-CALIFICACIÓN", timeLabel: "ESTA-SEMANA", nextStep: "Si no responde, marcar PERDIDO", nextAt: nextAt(48),
            sequence: "QUALIFICATION_FINAL_MESSAGE", action: "QUALIFICATION_FINAL_MESSAGE", followUpMode: mode,
          });
          actions.push({ leadId: lead.id, action: "QUALIFICATION_FINAL_MESSAGE" });
          continue;
        }
        await markLost(lead, state, "No completó los datos mínimos de calificación");
        actions.push({ leadId: lead.id, action: "LOST" });
        continue;
      }

      // Primer seguimiento escrito según la situación comercial.
      if (attempt <= 0) {
        let text = `Hola ${lead.name || ""}, ¿pudiste revisar la cotización? Si tienes alguna duda o quieres ajustar cantidades, con gusto te ayudo.`.replace(/\s+,/g, ",");
        let callDelay = 48;
        if (mode === "COMPARING") {
          text = "Quedo pendiente. Si estás comparando opciones, puedo ayudarte a revisar disponibilidad, entrega y condiciones para que compares sobre la misma base.";
          callDelay = 72;
        } else if (mode === "LATER") {
          text = "Retomo el pedido como habíamos dejado. ¿Sigue vigente tu interés para revisar disponibilidad y cotización?";
          callDelay = 72;
        } else if (mode === "AGREED_DATE") {
          text = `Hola ${lead.name || ""}, retomo lo que habíamos acordado. ¿Seguimos con el pedido?`.replace(/\s+,/g, ",");
          callDelay = 24;
        }
        await sendAgentWhatsAppText(lead, text, "AGENT");
        const nextState = { ...state, followUpAttempt: 1, nextStep: "Si no responde, realizar llamada", nextStepAt: nextAt(callDelay).toISOString() };
        await savePlan(lead.id, nextState, {
          stage: "SEGUIMIENTO", timeLabel: callDelay <= 24 ? "MAÑANA" : "ESTA-SEMANA",
          nextStep: "Si no responde, realizar llamada", nextAt: nextAt(callDelay),
          sequence: "MESSAGE_1", action: "FOLLOWUP_MESSAGE_1", followUpMode: mode,
        });
        await activity(lead.id, "Seguimiento 1 enviado por WhatsApp", { version: SALES_AGENT_VERSION, attempt: 1, mode });
        actions.push({ leadId: lead.id, action: "MESSAGE_1" });
        continue;
      }

      if (attempt === 1) {
        const created = await createCallTask(lead, state, "CALL", 2);
        if (created) actions.push({ leadId: lead.id, action: "CALL" });
        continue;
      }

      // Después de una llamada registrada como NO CONTESTÓ, los modos QUOTED y AGREED_DATE
      // esperan 5 días antes del último mensaje. COMPARING/LATER terminan en PERDIDO.
      if (attempt === 2) {
        if (mode === "COMPARING" || mode === "LATER") {
          await markLost(lead, state, "Sin respuesta después del mensaje y la llamada de seguimiento");
          actions.push({ leadId: lead.id, action: "LOST" });
          continue;
        }
        const text = `Hola ${lead.name || ""}, ¿sigue vigente tu interés${state.productName ? ` en ${state.productName}` : ""}? Quiero saber si te reservo disponibilidad o si por ahora no lo vas a necesitar. Cualquier respuesta me sirve.`.replace(/\s+,/g, ",");
        await sendAgentWhatsAppText(lead, text, "AGENT");
        const nextState = { ...state, followUpAttempt: 3, nextStep: "Si no responde al último mensaje, marcar PERDIDO", nextStepAt: nextAt(24).toISOString() };
        await savePlan(lead.id, nextState, {
          stage: "SEGUIMIENTO", timeLabel: "MAÑANA", nextStep: "Si no responde al último mensaje, marcar PERDIDO", nextAt: nextAt(24),
          sequence: "FINAL_MESSAGE", action: "FOLLOWUP_FINAL_MESSAGE", followUpMode: mode,
        });
        await activity(lead.id, "Seguimiento 3: último mensaje enviado", { version: SALES_AGENT_VERSION, attempt: 3, mode });
        actions.push({ leadId: lead.id, action: "FINAL_MESSAGE" });
        continue;
      }

      await markLost(lead, state, "Se agotaron los intentos de seguimiento sin respuesta");
      actions.push({ leadId: lead.id, action: "LOST" });
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
