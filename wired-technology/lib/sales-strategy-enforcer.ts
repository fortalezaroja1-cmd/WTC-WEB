import { prisma } from "@/lib/db";
import type { AgentDecision, SalesAgentState } from "@/lib/sales-agent-core";

export type CommercialStage =
  | "NUEVO"
  | "EN-CALIFICACIÓN"
  | "COTIZADO"
  | "SEGUIMIENTO"
  | "POR-CERRAR"
  | "VENDIDO"
  | "PERDIDO"
  | "RECOMPRA";

export type TimeLabel = "HOY" | "MAÑANA" | "ESTA-SEMANA" | "PRÓXIMA-SEMANA" | null;
export type FollowUpMode = "QUALIFICATION" | "QUOTED" | "AGREED_DATE" | "COMPARING" | "LATER" | "CALL_REQUEST" | "HUMAN" | null;

export type StrategicDecision = AgentDecision & {
  commercialStage: CommercialStage;
  timeLabel: TimeLabel;
  followUpMode: FollowUpMode;
};

type ExtendedState = SalesAgentState & {
  commercialStage?: CommercialStage;
  timeLabel?: TimeLabel;
  followUpMode?: FollowUpMode;
  followUpAttempt?: number;
  shippingAmount?: number;
  shippingRateId?: string;
  shippingCarrier?: string;
  shippingService?: string;
  shippingEta?: string;
  awaitingPreDispatchConfirmation?: boolean;
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function money(value: number) {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

function atHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function atDays(days: number) {
  return atHours(days * 24);
}

function timeLabelForHours(hours: number): TimeLabel {
  if (hours <= 12) return "HOY";
  if (hours <= 36) return "MAÑANA";
  if (hours <= 24 * 6) return "ESTA-SEMANA";
  return "PRÓXIMA-SEMANA";
}

function looksLikeLargeOrder(text: string) {
  const n = normalize(text);
  if (/\b(lista (grande|larga)|pedido grande|varias referencias|muchas referencias|armar (una )?lista)\b/.test(n)) return true;
  const lines = text.split(/\n|;/).map((line) => line.trim()).filter(Boolean);
  const productish = lines.filter((line) => /\b\d+\b/.test(line) && /[a-záéíóúñ]/i.test(line));
  return productish.length > 5;
}

async function selfServiceUrl() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "awayMessageConfig" } });
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      const configured = String(parsed?.selfServiceUrl || "").trim();
      if (configured) return /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
    } catch {}
  }
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function detectAgreement(text: string) {
  const n = normalize(text);
  if (/\b(estoy comparando|comparando precios|cotizando con otros|cotizando en otros|mirando otras opciones)\b/.test(n)) {
    return { mode: "COMPARING" as const, hours: 48, label: "ESTA-SEMANA" as TimeLabel, nextStep: "Seguimiento con diferenciador en 48 horas" };
  }
  if (/\b(despues|después|no ahora|mas adelante|más adelante|luego miro|luego te digo)\b/.test(n)) {
    return { mode: "LATER" as const, hours: 24 * 7, label: "PRÓXIMA-SEMANA" as TimeLabel, nextStep: "Retomar en 7 días" };
  }
  if (/\b(llamame|llámame|me llamas|me llaman|quiero que me llamen|puedes llamarme)\b/.test(n)) {
    return { mode: "CALL_REQUEST" as const, hours: 2, label: "HOY" as TimeLabel, nextStep: "Llamar al cliente dentro de 2 horas en horario laboral" };
  }
  if (/\b(manana confirmo|mañana confirmo|te confirmo manana|te confirmo mañana|manana te digo|mañana te digo)\b/.test(n)) {
    // La guía indica esperar la fecha acordada y, si pasa sin respuesta, escribir al día siguiente.
    return { mode: "AGREED_DATE" as const, hours: 48, label: "MAÑANA" as TimeLabel, nextStep: "Esperar confirmación de mañana; si no escribe, contactar al día siguiente" };
  }
  if (/\b(esta semana (te )?(digo|confirmo)|te digo esta semana|te confirmo esta semana)\b/.test(n)) {
    return { mode: "AGREED_DATE" as const, hours: 24 * 6, label: "ESTA-SEMANA" as TimeLabel, nextStep: "Esperar el acuerdo de esta semana; si vence, contactar al día siguiente" };
  }
  return null;
}

function qualificationReply() {
  return "Con gusto te cotizo. Para darte precio exacto con envío incluido, necesito: referencia/calibre, cantidad, ciudad/departamento y para cuándo lo necesitas. Con esos datos te cotizo de inmediato.";
}

function withStrategy(base: AgentDecision, input: {
  cap: "C" | "A" | "P";
  stage: CommercialStage;
  timeLabel?: TimeLabel;
  followUpMode?: FollowUpMode;
  nextStep?: string;
  nextStepAt?: string | null;
  reply?: string;
  action?: string;
  needsHuman?: boolean;
  state?: ExtendedState;
}): StrategicDecision {
  const nextState: ExtendedState = {
    ...(input.state || base.state || {}),
    commercialStage: input.stage,
    timeLabel: input.timeLabel ?? null,
    followUpMode: input.followUpMode ?? null,
  };
  if (input.nextStep !== undefined) nextState.nextStep = input.nextStep;
  if (input.nextStepAt === null) delete nextState.nextStepAt;
  else if (input.nextStepAt !== undefined) nextState.nextStepAt = input.nextStepAt;

  const status: AgentDecision["status"] = input.stage === "PERDIDO"
    ? "LOST"
    : input.stage === "COTIZADO"
      ? "QUOTED"
      : input.stage === "SEGUIMIENTO" || input.stage === "POR-CERRAR"
        ? "NEGOTIATION"
        : "CONTACTED";

  return {
    ...base,
    reply: input.reply ?? base.reply,
    action: input.action ?? base.action,
    needsHuman: input.needsHuman ?? base.needsHuman,
    cap: input.cap,
    status,
    state: nextState,
    commercialStage: input.stage,
    timeLabel: input.timeLabel ?? null,
    followUpMode: input.followUpMode ?? null,
  };
}

export async function enforceOriginalSalesStrategy(text: string, base: AgentDecision): Promise<StrategicDecision> {
  const state = { ...(base.state || {}) } as ExtendedState;
  const normalized = normalize(text);

  if (base.intent === "LOST") {
    return withStrategy(base, {
      cap: "P", stage: "PERDIDO", timeLabel: null, followUpMode: null,
      nextStep: "Sin seguimiento: el cliente indicó que no continuará", nextStepAt: null,
      action: "MARK_LOST", state: { ...state, followUpAttempt: 3 },
    });
  }

  if (looksLikeLargeOrder(text)) {
    const url = await selfServiceUrl();
    const reply = url
      ? `Para que te sea más fácil, arma tu pedido completo aquí: ${url}. Selecciona productos y cantidades y envíamelo; te cotizamos todo con envío incluido.`
      : "Veo que es un pedido de varias referencias. Para evitar errores, lo paso a un asesor para organizar la lista completa y cotizarla con envío incluido.";
    return withStrategy(base, {
      cap: "P", stage: "EN-CALIFICACIÓN", timeLabel: "MAÑANA", followUpMode: "QUALIFICATION",
      nextStep: url ? "Esperar pedido armado en la web; revisar si no responde" : "Asesor debe organizar pedido de múltiples referencias",
      nextStepAt: atHours(24), reply, action: url ? "SELF_SERVICE_LARGE_ORDER" : "HUMAN_LARGE_ORDER",
      needsHuman: !url, state,
    });
  }

  const agreement = detectAgreement(text);
  if (agreement?.mode === "CALL_REQUEST") {
    return withStrategy(base, {
      cap: "A", stage: "SEGUIMIENTO", timeLabel: agreement.label, followUpMode: agreement.mode,
      nextStep: agreement.nextStep, nextStepAt: atHours(agreement.hours),
      reply: "Claro. Dejo acordada la llamada dentro de las próximas 2 horas de horario laboral. La conversación queda registrada para que no tengas que repetir la información.",
      action: "AGREED_CALL", needsHuman: true, state,
    });
  }

  if (agreement) {
    return withStrategy(base, {
      cap: agreement.mode === "AGREED_DATE" ? "A" : "P",
      stage: "SEGUIMIENTO", timeLabel: agreement.label, followUpMode: agreement.mode,
      nextStep: agreement.nextStep, nextStepAt: atHours(agreement.hours),
      action: agreement.mode === "AGREED_DATE" ? "AGREED_NEXT_STEP" : `PLAN_${agreement.mode}`,
      state,
    });
  }

  if (base.intent === "CLAIM" || base.action === "VERIFY_AUTHENTICITY" || base.action === "DISCOUNT_REQUIRES_HUMAN" || base.action === "STOCK_SHORTAGE" || base.action === "PRICE_REQUIRES_HUMAN") {
    return withStrategy(base, {
      cap: "P", stage: state.commercialStage === "POR-CERRAR" ? "POR-CERRAR" : "SEGUIMIENTO",
      timeLabel: "HOY", followUpMode: "HUMAN", nextStep: "Atención humana requerida hoy",
      nextStepAt: atHours(2), needsHuman: true, state,
    });
  }

  if (["CLARIFY_PRODUCT", "QUALIFY", "COLLECT_QUALIFICATION", "QUALIFY_BEFORE_QUOTE"].includes(base.action)) {
    return withStrategy(base, {
      cap: "P", stage: "EN-CALIFICACIÓN", timeLabel: "MAÑANA", followUpMode: "QUALIFICATION",
      nextStep: "Esperar datos de calificación; revisar en 24 horas si no responde", nextStepAt: atHours(24),
      reply: base.action === "QUALIFY" || (base.missingFields || []).length >= 3 ? qualificationReply() : base.reply,
      state,
    });
  }

  const customerWantsToBuy = base.intent === "BUY" || ["COLLECT_CLOSE_DATA", "REQUEST_CONFIRMATION", "READY_TO_CLOSE"].includes(base.action);
  if (customerWantsToBuy) {
    const shipping = Number(state.shippingAmount);
    const hasShipping = Number.isFinite(shipping) && shipping >= 0;
    const missingClose = (base.missingFields || []).filter((field) => !["confirmación", "envío"].includes(field));

    if (missingClose.length) {
      return withStrategy(base, {
        cap: "C", stage: "POR-CERRAR", timeLabel: "HOY", followUpMode: null,
        nextStep: `Completar datos finales: ${missingClose.join(", ")}`, nextStepAt: atHours(2),
        action: "CLOSE_COLLECT_FINAL_DATA", state,
      });
    }

    if (!hasShipping) {
      return withStrategy(base, {
        cap: "C", stage: "POR-CERRAR", timeLabel: "HOY", followUpMode: "HUMAN",
        nextStep: "Calcular envío real y enviar verificación pre-despacho", nextStepAt: atHours(2),
        reply: "Ya tengo los datos para cerrar. Falta calcular el envío real para enviarte la verificación pre-despacho con el total contraentrega. No genero la guía hasta que confirmes esa verificación.",
        action: "CLOSE_PENDING_SHIPPING", needsHuman: true, state,
      });
    }

    const subtotal = Number(state.lastQuotedPrice || 0) * Number(state.qty || 0);
    const total = subtotal + shipping;
    const product = [state.productName, state.variantName].filter(Boolean).join(" · ");
    const reply = `Perfecto, te confirmo: ${product} — ${state.qty} — ${state.color || "color por confirmar"}. Envío a: ${state.city} / ${state.address || "dirección pendiente"}. Total contraentrega: ${money(total)}. ¿Todo correcto? Con tu confirmación genero la guía.`;
    return withStrategy(base, {
      cap: "C", stage: "POR-CERRAR", timeLabel: "HOY", followUpMode: null,
      nextStep: "Esperar confirmación de verificación pre-despacho", nextStepAt: atHours(24),
      reply, action: "PRE_DISPATCH_VERIFICATION", state: { ...state, awaitingPreDispatchConfirmation: true },
    });
  }

  if (state.awaitingPreDispatchConfirmation && /\b(si|sí|confirmo|correcto|todo correcto|de acuerdo)\b/.test(normalized)) {
    return withStrategy(base, {
      cap: "C", stage: "POR-CERRAR", timeLabel: "HOY", followUpMode: null,
      nextStep: "Verificación confirmada: generar guía y despachar", nextStepAt: atHours(2),
      reply: "Perfecto. La verificación pre-despacho quedó confirmada. El pedido ya puede pasar a generación de guía y despacho.",
      action: "PRE_DISPATCH_CONFIRMED", needsHuman: true,
      state: { ...state, awaitingPreDispatchConfirmation: false },
    });
  }

  if (base.action === "QUOTE_PENDING_SHIPPING") {
    return withStrategy(base, {
      cap: "P", stage: "EN-CALIFICACIÓN", timeLabel: "HOY", followUpMode: "HUMAN",
      nextStep: "Completar costo de envío antes de marcar COTIZADO", nextStepAt: atHours(2),
      action: "QUOTE_PENDING_SHIPPING", needsHuman: true, state,
    });
  }

  if (base.status === "QUOTED") {
    return withStrategy(base, {
      cap: "P", stage: "COTIZADO", timeLabel: "HOY", followUpMode: "QUOTED",
      nextStep: "Si no responde, seguimiento por WhatsApp en 24 horas", nextStepAt: atHours(24),
      state,
    });
  }

  if (base.needsHuman || base.intent === "HUMAN") {
    return withStrategy(base, {
      cap: "P", stage: "SEGUIMIENTO", timeLabel: "HOY", followUpMode: "HUMAN",
      nextStep: "Atención humana requerida", nextStepAt: atHours(2), needsHuman: true, state,
    });
  }

  return withStrategy(base, {
    cap: "P", stage: state.productId ? "EN-CALIFICACIÓN" : "NUEVO",
    timeLabel: "MAÑANA", followUpMode: "QUALIFICATION",
    nextStep: "Continuar calificación; revisar en 24 horas si no responde", nextStepAt: atHours(24),
    state,
  });
}

export function strategicTimeLabelForDelay(hours: number): TimeLabel {
  return timeLabelForHours(hours);
}
