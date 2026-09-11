import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { ensureCrmTables, saveOutboundWhatsAppMessage } from "@/lib/crm";

const AGENT_VERSION = "WT_RULES_V1";
const FOLLOW_UP_HOURS = 24;

const PRODUCT_ALIASES: Array<{ words: string[]; match: string[] }> = [
  { words: ["alambre", "thhn", "cable un hilo", "cable 1 hilo"], match: ["alambre", "thhn"] },
  { words: ["7 hilos", "siete hilos", "cable flexible"], match: ["7 hilos"] },
  { words: ["duplex", "dúplex"], match: ["duplex"] },
  { words: ["panel", "panel led"], match: ["panel led"] },
  { words: ["bombillo", "bombilla"], match: ["bombillo"] },
  { words: ["plafon", "plafón", "roseta", "roceta"], match: ["plafon"] },
  { words: ["tomacorriente", "toma corriente", "toma doble"], match: ["tomacorriente"] },
  { words: ["interruptor"], match: ["interruptor"] },
  { words: ["breaker", "taco"], match: ["breaker"] },
  { words: ["caja", "caja pvc"], match: ["caja"] },
  { words: ["tablero"], match: ["tablero"] },
];

const COLOMBIAN_CITIES = [
  "bogota", "medellin", "cali", "barranquilla", "cartagena", "bucaramanga", "pereira",
  "manizales", "cucuta", "ibague", "villavicencio", "monteria", "valledupar", "pasto",
  "neiva", "armenia", "sincelejo", "santa marta", "tunja", "popayan", "yopal", "florencia",
  "riohacha", "quibdo", "soacha", "chigorodo", "buenaventura", "san vicente del caguan",
];

const COLOR_WORDS = ["rojo", "blanco", "azul", "amarillo", "negro", "verde", "gris", "naranja"];

export type SalesAgentState = {
  productId?: string;
  variantId?: string;
  sku?: string;
  productName?: string;
  variantName?: string;
  qty?: number;
  city?: string;
  barrio?: string;
  address?: string;
  color?: string;
  customerName?: string;
  customerType?: string;
  urgency?: string;
  awaitingConfirmation?: boolean;
  lastQuotedPrice?: number;
  lastStock?: number;
};

type CatalogChoice = {
  productId: string;
  variantId: string | null;
  sku: string;
  productName: string;
  variantName: string | null;
  unit: string;
  price: number | null;
  stock: number;
  brand: string;
  category: string;
  genericCentelsa: boolean;
  requiresVariant: boolean;
  score: number;
};

type AgentDecision = {
  reply: string;
  status: "CONTACTED" | "QUOTED" | "NEGOTIATION" | "LOST";
  intent: string;
  confidence: number;
  needsHuman: boolean;
  cap: "PLAN" | "CLOSE" | "HUMAN" | "NONE";
  state: SalesAgentState;
  action: string;
};

let agentTablesReady: Promise<void> | null = null;

async function ensureAgentColumns() {
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

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9#x\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCOP(value: number) {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

function extractLabeled(text: string, labels: string[]) {
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\n|\\b)${label}\\s*[:=-]\\s*([^\\n,;]{2,80})`, "i");
    const match = text.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractQuantity(text: string) {
  const labeled = text.match(/(?:cantidad|cant)\s*[:=-]?\s*(\d{1,4})/i);
  if (labeled) return Number(labeled[1]);
  const units = text.match(/\b(\d{1,4})\s*(rollos?|unidades?|unds?|und\.?|cajas?|bombillos?|paneles?|breakers?|tableros?|tomas?|interruptores?)\b/i);
  if (units) return Number(units[1]);
  return null;
}

function extractCity(text: string) {
  const explicit = extractLabeled(text, ["ciudad", "municipio"]);
  if (explicit) return explicit;
  const n = normalize(text);
  const city = COLOMBIAN_CITIES.find((item) => n.includes(item));
  if (!city) return null;
  return city.replace(/\b\w/g, (x) => x.toUpperCase());
}

function extractColor(text: string) {
  const n = normalize(text);
  const found = COLOR_WORDS.filter((color) => n.includes(color));
  return found.length ? found.join(", ") : null;
}

function detectIntent(text: string, state: SalesAgentState) {
  const n = normalize(text);
  if (state.awaitingConfirmation && /\b(confirmo|confirmado|si confirmo|correcto|de acuerdo)\b/.test(n)) return "CONFIRM";
  if (/\b(asesor|humano|persona|vendedor|llamame|llamarme|me llaman)\b/.test(n)) return "HUMAN";
  if (/\b(reclamo|devolucion|devolver|danado|defectuoso|error en el pedido|producto equivocado)\b/.test(n)) return "CLAIM";
  if (/\b(no me interesa|no gracias|ya no quiero|cancelar|cancele)\b/.test(n)) return "LOST";
  if (/centelsa/.test(n) && /\b(original|originales|imitacion|generico)\b/.test(n)) return "ORIGINALITY";
  if (/\b(no confio|estafa|seguro|seguridad|confianza)\b/.test(n)) return "TRUST";
  if (/\b(envio|domicilio|contraentrega|pago en casa|pagar en casa|entrega)\b/.test(n)) return "SHIPPING";
  if (/\b(stock|disponible|disponibilidad|tienen|hay)\b/.test(n)) return "STOCK";
  if (/\b(precio|vale|cuanto|costo|cotiza|cotizacion|valor)\b/.test(n)) return "PRICE";
  if (/\b(quiero|me interesa|mandeme|envieme|lo compro|comprar|pedido|programar|programame|listo hagale|dale)\b/.test(n)) return "BUY";
  if (/\b(hola|buenos dias|buenas tardes|buenas noches|informacion|info)\b/.test(n)) return "GREETING";
  return "INFO";
}

function descriptorFromText(text: string) {
  const n = normalize(text);
  const duplex = n.match(/\b2\s*x\s*(10|12|14)\b/);
  if (duplex) return `2 x ${duplex[1]}`;
  const caliber = n.match(/(?:calibre\s*|#\s*)(8|10|12|14)\b/);
  if (caliber) return `#${caliber[1]}`;
  const watt = n.match(/\b(3|6|9|12|15|18|20|24|30|36|40|50)\s*w\b/);
  if (watt) return `${watt[1]} w`;
  const amp = n.match(/\b(15|20|30|40|50|60)\s*a\b/);
  if (amp) return `${amp[1]} a`;
  const circuits = n.match(/\b(2|4|6|8|12)\s*circuitos?\b/);
  if (circuits) return `${circuits[1]} circuitos`;
  return null;
}

async function matchCatalog(text: string, previous: SalesAgentState): Promise<CatalogChoice | null> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    include: { variants: { where: { active: true }, orderBy: { order: "asc" } }, brand: true, category: true, subcategory: true },
  });

  const n = normalize(text);
  const descriptor = descriptorFromText(text);
  let best: CatalogChoice | null = null;

  for (const product of products) {
    const productText = normalize(`${product.name} ${product.category?.name || ""} ${product.subcategory?.name || ""} ${product.brand?.name || ""}`);
    let score = previous.productId === product.id ? 2.5 : 0;

    for (const alias of PRODUCT_ALIASES) {
      if (alias.words.some((word) => n.includes(normalize(word))) && alias.match.some((word) => productText.includes(normalize(word)))) score += 5;
    }

    const meaningful = n.split(" ").filter((token) => token.length >= 4 && !["precio", "cuanto", "tienen", "quiero", "necesito", "para", "envio", "ciudad"].includes(token));
    for (const token of meaningful) if (productText.includes(token)) score += 0.8;

    let variant: any = null;
    if (product.variants.length) {
      if (previous.variantId) variant = product.variants.find((item) => item.id === previous.variantId) || null;
      if (descriptor) {
        const d = normalize(descriptor).replace("#", "");
        variant = product.variants.find((item) => {
          const vn = normalize(item.name).replace("#", "");
          return vn.includes(d) || d.split(" ").every((part) => vn.includes(part));
        }) || variant;
        if (variant) score += 4;
      }
    }

    if (score < 3 && previous.productId !== product.id) continue;
    const candidate: CatalogChoice = {
      productId: product.id,
      variantId: variant?.id || null,
      sku: variant?.sku || product.sku,
      productName: product.name,
      variantName: variant?.name || null,
      unit: product.unit,
      price: variant ? Number(variant.promoPrice ?? variant.price) : product.price !== null ? Number(product.promoPrice ?? product.price) : null,
      stock: variant ? Number(variant.stock) : Number(product.stock),
      brand: product.brand?.name || "",
      category: product.category?.name || "",
      genericCentelsa: normalize(product.brand?.name).includes("centelsa") || normalize(product.name).includes("centelsa"),
      requiresVariant: product.variants.length > 0 && !variant,
      score,
    };
    if (!best || candidate.score > best.score) best = candidate;
  }

  return best;
}

function mergeState(text: string, lead: any, prior: SalesAgentState, choice: CatalogChoice | null): SalesAgentState {
  const state: SalesAgentState = { ...prior };
  const qty = extractQuantity(text);
  const city = extractCity(text);
  const barrio = extractLabeled(text, ["barrio"]);
  const address = extractLabeled(text, ["direccion", "dirección", "dir"]);
  const name = extractLabeled(text, ["nombre"]);
  const color = extractColor(text);
  const customerType = extractLabeled(text, ["tipo de cliente", "cliente"]);
  const urgency = /\b(hoy|urgente|ya mismo)\b/i.test(text) ? "HOY" : /\b(manana|mañana)\b/i.test(text) ? "MAÑANA" : undefined;

  if (qty && qty > 0) state.qty = qty;
  if (city) state.city = city;
  if (barrio) state.barrio = barrio;
  if (address) state.address = address;
  if (name) state.customerName = name;
  else if (!state.customerName && lead?.name) state.customerName = String(lead.name);
  if (color) state.color = color;
  if (customerType) state.customerType = customerType;
  if (urgency) state.urgency = urgency;

  if (choice) {
    state.productId = choice.productId;
    state.variantId = choice.variantId || undefined;
    state.sku = choice.sku;
    state.productName = choice.productName;
    state.variantName = choice.variantName || undefined;
    state.lastQuotedPrice = choice.price ?? undefined;
    state.lastStock = choice.stock;
  }
  return state;
}

function productLabel(choice: CatalogChoice) {
  const base = choice.genericCentelsa
    ? choice.productName.replace(/centelsa/ig, "tipo CENTELSA")
    : choice.productName;
  return choice.variantName ? `${base} · ${choice.variantName}` : base;
}

function missingCloseFields(state: SalesAgentState, choice: CatalogChoice | null) {
  const missing: string[] = [];
  if (!choice) missing.push("producto");
  else if (choice.requiresVariant) missing.push("medida/calibre/potencia");
  if (!state.qty) missing.push("cantidad");
  if (!state.city) missing.push("ciudad");
  if (!state.address) missing.push("dirección");
  if (!state.barrio) missing.push("barrio");
  if (choice?.genericCentelsa && !state.color) missing.push("color");
  return missing;
}

function buildDecision(text: string, lead: any, intent: string, state: SalesAgentState, choice: CatalogChoice | null): AgentDecision {
  const payment = "Tenemos pago en casa / contraentrega para que pagues al recibir.";
  const genericNotice = choice?.genericCentelsa
    ? "Importante: no es CENTELSA original; es material genérico tipo CENTELSA, de alta calidad. "
    : "";

  if (intent === "HUMAN" || intent === "CLAIM") {
    return {
      reply: intent === "CLAIM"
        ? "Voy a dejar este caso marcado para revisión de un asesor. Envíame por favor el número de pedido y, si aplica, fotos del producto o daño."
        : "Te dejo con un asesor para continuar la atención. Ya queda el caso marcado en el CRM para que no tengas que empezar de cero.",
      status: lead.status === "NEW" ? "CONTACTED" : lead.status,
      intent,
      confidence: 1,
      needsHuman: true,
      cap: "HUMAN",
      state,
      action: "ESCALATE_HUMAN",
    };
  }

  if (intent === "LOST") {
    return {
      reply: "Entendido. Dejo la conversación cerrada para no seguir insistiendo. Si más adelante necesitas material eléctrico, puedes escribirnos por este mismo chat.",
      status: "LOST",
      intent,
      confidence: 0.98,
      needsHuman: false,
      cap: "NONE",
      state: { ...state, awaitingConfirmation: false },
      action: "MARK_LOST",
    };
  }

  if (intent === "ORIGINALITY") {
    return {
      reply: "No es CENTELSA original. Es material genérico tipo CENTELSA, de alta calidad. Te lo llevamos y pagas en casa al recibir. Si me dices calibre, cantidad y ciudad, te confirmo precio y disponibilidad.",
      status: "CONTACTED",
      intent,
      confidence: 1,
      needsHuman: false,
      cap: "PLAN",
      state,
      action: "ANSWER_ORIGINALITY",
    };
  }

  if (intent === "TRUST") {
    return {
      reply: `Puedes pagar en casa / contraentrega al recibir. También te confirmamos producto, cantidades y datos de entrega antes del despacho. ${choice ? `Sobre ${productLabel(choice)}, puedo validarte precio y stock aquí mismo.` : "Dime qué producto buscas y para qué ciudad es."}`,
      status: choice ? "QUOTED" : "CONTACTED",
      intent,
      confidence: 0.95,
      needsHuman: false,
      cap: "PLAN",
      state,
      action: "ANSWER_TRUST",
    };
  }

  if (state.awaitingConfirmation && intent === "CONFIRM" && choice) {
    const missing = missingCloseFields(state, choice);
    if (!missing.length) {
      const subtotal = choice.price && state.qty ? choice.price * state.qty : null;
      return {
        reply: `Confirmado. Dejo el negocio en POR CERRAR para validación final de envío y programación. ${productLabel(choice)}, cantidad ${state.qty}${state.color ? `, color ${state.color}` : ""}, ${state.city}, barrio ${state.barrio}. ${subtotal ? `Subtotal de producto: ${formatCOP(subtotal)}. ` : ""}El valor de envío se valida antes de programar. ${payment}`,
        status: "NEGOTIATION",
        intent,
        confidence: 0.99,
        needsHuman: true,
        cap: "CLOSE",
        state: { ...state, awaitingConfirmation: false },
        action: "READY_TO_CLOSE",
      };
    }
  }

  if (!choice) {
    const reply = intent === "SHIPPING"
      ? `Hacemos envíos y manejamos pago en casa / contraentrega. Para confirmarte condiciones necesito producto, medida o calibre, cantidad y ciudad/barrio.`
      : "¿Qué producto necesitas (tipo/medida/calibre), cuánta cantidad y para qué ciudad/barrio es? Tenemos pago en casa / contraentrega.";
    return { reply, status: "CONTACTED", intent, confidence: 0.72, needsHuman: false, cap: "PLAN", state, action: "QUALIFY" };
  }

  if (choice.requiresVariant) {
    return {
      reply: `${genericNotice}Sí manejamos ${productLabel(choice)}. Necesito la medida, calibre, potencia o amperaje exacto para darte el precio y stock correctos. También dime cantidad y ciudad. ${payment}`,
      status: "CONTACTED",
      intent,
      confidence: Math.min(choice.score / 8, 0.9),
      needsHuman: false,
      cap: "PLAN",
      state,
      action: "ASK_VARIANT",
    };
  }

  if (state.qty && choice.stock < state.qty) {
    return {
      reply: `${genericNotice}Para ${productLabel(choice)} aparecen ${choice.stock} disponibles y estás solicitando ${state.qty}. Voy a marcarlo para que un asesor valide reposición o una alternativa equivalente antes de prometerte entrega.`,
      status: "NEGOTIATION",
      intent,
      confidence: 0.98,
      needsHuman: true,
      cap: "HUMAN",
      state,
      action: "STOCK_SHORTAGE",
    };
  }

  const hasPrice = choice.price !== null;
  const subtotal = hasPrice && state.qty ? Number(choice.price) * state.qty : null;
  const stockText = choice.stock > 0 ? `Stock registrado: ${choice.stock}.` : "En este momento aparece sin stock disponible.";
  const priceText = hasPrice ? `Precio actual: ${formatCOP(Number(choice.price))} por ${choice.unit}.` : "El precio requiere validación antes de cotizar.";

  if (intent === "BUY") {
    const missing = missingCloseFields(state, choice);
    if (missing.length) {
      return {
        reply: `${genericNotice}${productLabel(choice)}. ${priceText} ${stockText} Para dejarlo listo necesito: ${missing.join(", ")}. Envíame esos datos y seguimos con la programación. ${payment}`,
        status: "NEGOTIATION",
        intent,
        confidence: 0.94,
        needsHuman: !hasPrice || choice.stock <= 0,
        cap: "PLAN",
        state,
        action: "COLLECT_CLOSE_DATA",
      };
    }

    const summary = `${productLabel(choice)}, cantidad ${state.qty}${state.color ? `, color ${state.color}` : ""}, entrega en ${state.city}, barrio ${state.barrio}, dirección ${state.address}`;
    return {
      reply: `${genericNotice}Tengo estos datos: ${summary}. ${subtotal ? `Subtotal de producto: ${formatCOP(subtotal)}. ` : ""}El valor de envío se confirma antes de programar. ${payment} Si todo está correcto, responde CONFIRMO.`,
      status: "NEGOTIATION",
      intent,
      confidence: 0.97,
      needsHuman: false,
      cap: "PLAN",
      state: { ...state, awaitingConfirmation: true },
      action: "REQUEST_CONFIRMATION",
    };
  }

  if (["PRICE", "STOCK", "SHIPPING", "INFO"].includes(intent)) {
    const qualification: string[] = [];
    if (!state.qty) qualification.push("cantidad");
    if (!state.city) qualification.push("ciudad");
    return {
      reply: `${genericNotice}${productLabel(choice)}. ${priceText} ${stockText}${subtotal ? ` Subtotal de producto para ${state.qty}: ${formatCOP(subtotal)}.` : ""} ${payment}${qualification.length ? ` Para cotizarte completo dime ${qualification.join(" y ")}.` : " ¿Te lo programo?"}`,
      status: hasPrice ? "QUOTED" : "CONTACTED",
      intent,
      confidence: Math.min(0.99, 0.72 + choice.score / 20),
      needsHuman: !hasPrice || choice.stock <= 0,
      cap: "PLAN",
      state,
      action: hasPrice ? "QUOTE" : "INFO",
    };
  }

  return {
    reply: `${genericNotice}${productLabel(choice)}. ${priceText} ${stockText} ${payment} Dime cantidad y ciudad/barrio para continuar.`,
    status: hasPrice ? "QUOTED" : "CONTACTED",
    intent,
    confidence: 0.82,
    needsHuman: false,
    cap: "PLAN",
    state,
    action: "PRODUCT_INFO",
  };
}

async function addActivity(leadId: string, text: string, meta: unknown) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CrmActivity" ("id", "leadId", "type", "text", "meta", "createdAt") VALUES ($1, $2, 'AGENT', $3, $4::jsonb, NOW())`,
    randomUUID(), leadId, text, JSON.stringify(meta ?? {})
  );
}

async function sendWhatsAppText(lead: any, text: string) {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("META_WHATSAPP_ACCESS_TOKEN no configurado");

  const metadataRows = await prisma.$queryRawUnsafe<Array<{ phoneNumberId: string | null }>>(
    `SELECT "payload"->'value'->'metadata'->>'phone_number_id' AS "phoneNumberId" FROM "CrmMessage" WHERE "leadId" = $1 AND "direction" = 'INBOUND' ORDER BY "sentAt" DESC, "createdAt" DESC LIMIT 1`,
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

  await saveOutboundWhatsAppMessage({ leadId: lead.id, metaMessageId: String(metaMessageId), text, payload });
}

async function persistDecision(leadId: string, decision: AgentDecision) {
  const nextAt = new Date(Date.now() + FOLLOW_UP_HOURS * 60 * 60 * 1000);
  const stateJson = JSON.stringify(decision.state);

  if (decision.cap === "CLOSE") {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "status"=$2, "agentState"=$3::jsonb, "agentLastIntent"=$4, "agentConfidence"=$5, "agentNeedsHuman"=$6, "agentLastAction"=$7, "agentLastReplyAt"=NOW(), "capPending"=false, "capStep"='C', "capC"=true, "capA"=false, "capP"=false, "capDecision"='C', "capLabel"='POR-CERRAR', "capNextStep"='Validar envío, crear pedido y programar despacho', "capNextAt"=NULL, "capSequence"=NULL, "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
      leadId, decision.status, stateJson, decision.intent, decision.confidence, decision.needsHuman, decision.action
    );
  } else if (decision.cap === "HUMAN") {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "status"=$2, "agentState"=$3::jsonb, "agentLastIntent"=$4, "agentConfidence"=$5, "agentNeedsHuman"=true, "agentLastAction"=$6, "agentLastReplyAt"=NOW(), "capPending"=false, "capStep"='P', "capC"=false, "capA"=false, "capP"=true, "capDecision"='P', "capLabel"='LLAMADA', "capNextStep"='Atención humana requerida por el agente', "capNextAt"=NOW(), "capSequence"='CALL', "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
      leadId, decision.status, stateJson, decision.intent, decision.confidence, decision.action
    );
  } else if (decision.cap === "PLAN") {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "status"=$2, "agentState"=$3::jsonb, "agentLastIntent"=$4, "agentConfidence"=$5, "agentNeedsHuman"=$6, "agentLastAction"=$7, "agentLastReplyAt"=NOW(), "capPending"=false, "capStep"='P', "capC"=false, "capA"=false, "capP"=true, "capDecision"='P', "capLabel"=CASE WHEN $2='QUOTED' THEN 'COTIZADO' ELSE 'SEGUIMIENTO' END, "capNextStep"='Seguimiento automático del agente', "capNextAt"=$8, "capSequence"='MESSAGE', "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
      leadId, decision.status, stateJson, decision.intent, decision.confidence, decision.needsHuman, decision.action, nextAt
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "status"=$2, "agentState"=$3::jsonb, "agentLastIntent"=$4, "agentConfidence"=$5, "agentNeedsHuman"=$6, "agentLastAction"=$7, "agentLastReplyAt"=NOW(), "capPending"=false, "capDecision"=CASE WHEN $2='LOST' THEN 'LOST' ELSE "capDecision" END, "capCompletedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1`,
      leadId, decision.status, stateJson, decision.intent, decision.confidence, decision.needsHuman, decision.action
    );
  }
}

export async function processInboundLeadWithAgent(input: { leadId: string; metaMessageId: string; text: string | null; source?: string }) {
  if (String(process.env.CRM_AGENT_ENABLED || "true").toLowerCase() === "false") return { skipped: "GLOBAL_DISABLED" };
  if (!input.text || input.text.startsWith("[")) return { skipped: "NON_TEXT" };

  await ensureAgentColumns();
  const leads = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Lead" WHERE "id"=$1 LIMIT 1`, input.leadId);
  const lead = leads[0];
  if (!lead || lead.agentEnabled === false) return { skipped: "LEAD_DISABLED" };

  const claimed = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "Lead" SET "agentLastInboundId"=$2, "updatedAt"=NOW() WHERE "id"=$1 AND COALESCE("agentLastInboundId", '') <> $2 RETURNING "id"`,
    input.leadId, input.metaMessageId
  );
  if (!claimed.length) return { skipped: "ALREADY_PROCESSED" };

  const prior: SalesAgentState = lead.agentState && typeof lead.agentState === "object" ? lead.agentState : {};
  const choice = await matchCatalog(input.text, prior);
  const state = mergeState(input.text, lead, prior, choice);
  const intent = detectIntent(input.text, state);
  const decision = buildDecision(input.text, lead, intent, state, choice);

  if (input.source === "META_TEST") {
    await persistDecision(input.leadId, { ...decision, needsHuman: true, action: `DRY_RUN_${decision.action}` });
    await addActivity(input.leadId, `Agente (prueba): ${decision.action}`, { version: AGENT_VERSION, intent, reply: decision.reply, state: decision.state });
    return { ok: true, dryRun: true, decision };
  }

  try {
    await sendWhatsAppText(lead, decision.reply);
    await persistDecision(input.leadId, decision);
    await addActivity(input.leadId, `Agente: ${decision.action}`, { version: AGENT_VERSION, intent, confidence: decision.confidence, state: decision.state });

    if (decision.needsHuman || decision.cap === "CLOSE") {
      await prisma.notification.create({
        data: {
          type: decision.cap === "CLOSE" ? "crm_ready_to_close" : "crm_agent_handoff",
          message: decision.cap === "CLOSE"
            ? `${lead.name || lead.phone || "Lead"} quedó POR CERRAR · revisar envío y programación`
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
    await addActivity(input.leadId, "Agente: error enviando respuesta", { version: AGENT_VERSION, error: error?.message || String(error) });
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
    `UPDATE "Lead" SET "status"=$2, "agentLastAction"='SYSTEM_STAGE_SYNC', "agentNeedsHuman"=false, "updatedAt"=NOW() WHERE regexp_replace(COALESCE("phone", ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g') RETURNING "id"`,
    phone, status
  );
  for (const row of rows) await addActivity(row.id, reason, { version: AGENT_VERSION, status, source: "ORDER_SYNC" });
  return rows.length;
}
