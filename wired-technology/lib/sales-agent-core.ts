import { prisma } from "@/lib/db";

export const SALES_AGENT_VERSION = "WT_RULES_V2";
export const SALES_AGENT_MAX_WORDS = 60;
export const SALES_AGENT_FOLLOW_UP_HOURS = 24;

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
  candidateProductIds?: string[];
  candidateLabels?: string[];
  nextStep?: string;
  nextStepAt?: string;
  followUpAttempt?: number;
};

export type CatalogChoice = {
  productId: string;
  variantId: string | null;
  sku: string;
  productName: string;
  variantName: string | null;
  unit: string;
  price: number | null;
  basePrice: number | null;
  promoPrice: number | null;
  stock: number;
  brand: string;
  category: string;
  requiresVariant: boolean;
  requiresColor: boolean;
  authenticity: "ORIGINAL" | "GENERIC" | "UNKNOWN";
  score: number;
};

export type AgentDecision = {
  reply: string;
  status: "CONTACTED" | "QUOTED" | "NEGOTIATION" | "LOST";
  intent: string;
  confidence: number;
  needsHuman: boolean;
  cap: "C" | "A" | "P" | "HUMAN" | "NONE";
  state: SalesAgentState;
  action: string;
  matchedProduct: CatalogChoice | null;
  candidates: Array<Pick<CatalogChoice, "productId" | "productName" | "sku" | "price" | "stock" | "unit" | "score">>;
  missingFields: string[];
};

type CatalogResult = {
  choice: CatalogChoice | null;
  candidates: CatalogChoice[];
  ambiguous: boolean;
};

type Descriptor =
  | { kind: "gauge"; value: string }
  | { kind: "duplex"; value: string }
  | { kind: "watts"; value: string }
  | { kind: "amps"; value: string }
  | { kind: "circuits"; value: string }
  | { kind: "dimension"; value: string }
  | { kind: "pipe"; value: string };

const PRODUCT_FAMILIES: Array<{ query: string[]; product: string[]; weight: number }> = [
  { query: ["alambre", "thhn", "cable un hilo", "cable 1 hilo"], product: ["alambre"], weight: 6 },
  { query: ["7 hilos", "siete hilos", "cable flexible"], product: ["7 hilos"], weight: 7 },
  { query: ["duplex", "dúplex"], product: ["duplex"], weight: 7 },
  { query: ["serie"], product: ["serie"], weight: 7 },
  { query: ["panel led", "panel"], product: ["panel led"], weight: 6 },
  { query: ["incrustar", "empotrado", "empotrable"], product: ["incrustar"], weight: 6 },
  { query: ["sobreponer", "sobrepuesto"], product: ["sobreponer"], weight: 6 },
  { query: ["bombillo", "bombilla"], product: ["bombillo"], weight: 7 },
  { query: ["plafon", "plafón", "roseta", "roceta"], product: ["plafon", "roceta"], weight: 7 },
  { query: ["tomacorriente", "toma corriente", "toma doble"], product: ["tomacorriente"], weight: 7 },
  { query: ["toma interruptor", "toma + interruptor", "toma con interruptor"], product: ["toma interruptor", "toma + interruptor"], weight: 8 },
  { query: ["interruptor"], product: ["interruptor"], weight: 6 },
  { query: ["breaker", "taco"], product: ["breaker"], weight: 7 },
  { query: ["caja", "caja pvc"], product: ["caja"], weight: 5 },
  { query: ["tablero"], product: ["tablero"], weight: 7 },
  { query: ["capuchon", "capuchones", "conector rojo", "conectores rojos"], product: ["capuchon"], weight: 7 },
  { query: ["cinta", "cinta aislante"], product: ["cinta aislante"], weight: 7 },
  { query: ["curva", "curva pvc"], product: ["curva pvc"], weight: 7 },
  { query: ["medidor"], product: ["medidor"], weight: 7 },
];

const COLOMBIAN_CITIES = [
  "bogota", "medellin", "cali", "barranquilla", "cartagena", "bucaramanga", "pereira",
  "manizales", "cucuta", "ibague", "villavicencio", "monteria", "valledupar", "pasto",
  "neiva", "armenia", "sincelejo", "santa marta", "tunja", "popayan", "yopal", "florencia",
  "riohacha", "quibdo", "soacha", "chigorodo", "buenaventura", "san vicente del caguan",
  "duitama", "sogamoso", "girardot", "mosquera", "funza", "facatativa", "zipaquira", "chia",
  "fusagasuga", "palmira", "tulua", "buga", "envigado", "itagui", "bello", "rionegro",
];

const COLOR_WORDS = ["rojo", "blanco", "azul", "amarillo", "negro", "verde", "gris", "naranja", "cafe", "marron"];
const STOP_WORDS = new Set([
  "precio", "precios", "cuanto", "cuánto", "tienen", "tiene", "quiero", "necesito", "para", "envio", "envío",
  "ciudad", "valor", "costo", "cotizacion", "cotización", "hola", "buenas", "informacion", "información", "por", "favor",
  "rollo", "rollos", "unidad", "unidades", "und", "caja", "cajas", "hoy", "manana", "mañana",
]);

export function normalizeAgentText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9#x+\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCOP(value: number) {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

function extractLabeled(text: string, labels: string[]) {
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\n|\\b)${label}\\s*[:=-]\\s*([^\\n,;]{2,100})`, "i");
    const match = text.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractQuantity(text: string) {
  const labeled = text.match(/(?:cantidad|cant)\s*[:=-]?\s*(\d{1,5})/i);
  if (labeled) return Number(labeled[1]);
  const units = text.match(/\b(\d{1,5})\s*(rollos?|unidades?|unds?|und\.?|cajas?|bolsas?|bombillos?|paneles?|breakers?|tableros?|tomas?|interruptores?|metros?|m\b|curvas?|cintas?|medidores?)\b/i);
  if (units) return Number(units[1]);
  return null;
}

function extractCity(text: string) {
  const explicit = extractLabeled(text, ["ciudad", "municipio"]);
  if (explicit) return explicit;
  const n = normalizeAgentText(text);
  const city = COLOMBIAN_CITIES.find((item) => n.includes(item));
  if (!city) return null;
  return city.replace(/\b\w/g, (x) => x.toUpperCase());
}

function extractColor(text: string) {
  const n = normalizeAgentText(text);
  const found = COLOR_WORDS.filter((color) => new RegExp(`\\b${color}\\b`).test(n));
  return found.length ? found.join(", ") : null;
}

function extractUrgency(text: string) {
  const n = normalizeAgentText(text);
  if (/\b(hoy|urgente|ya mismo|lo antes posible|inmediato)\b/.test(n)) return "HOY";
  if (/\b(manana|mañana)\b/.test(n)) return "MAÑANA";
  if (/\b(esta semana|semana)\b/.test(n)) return "ESTA SEMANA";
  if (/\b(no tengo afan|sin afan|puede esperar|no es urgente)\b/.test(n)) return "SIN URGENCIA";
  const explicit = extractLabeled(text, ["urgencia", "para cuando", "para cuándo"]);
  return explicit || null;
}

function extractCustomerType(text: string) {
  const n = normalizeAgentText(text);
  if (/\b(reventa|revender|ferreteria|ferretero|distribuidor|mayorista)\b/.test(n)) return "REVENTA";
  if (/\b(obra|instalacion|instalador|electricista|uso propio|casa|apartamento)\b/.test(n)) return "USO/OBRA";
  return extractLabeled(text, ["tipo de cliente", "cliente"]);
}

function detectIntent(text: string, state: SalesAgentState) {
  const n = normalizeAgentText(text);
  if (state.awaitingConfirmation && /\b(confirmo|confirmado|si confirmo|sí confirmo|correcto|de acuerdo|hagale|hágale)\b/.test(n)) return "CONFIRM";
  if (/\b(asesor|humano|persona|vendedor|llamame|llamarme|me llaman|quiero hablar)\b/.test(n)) return "HUMAN";
  if (/\b(reclamo|devolucion|devolución|devolver|danado|dañado|defectuoso|error en el pedido|producto equivocado|garantia|garantía)\b/.test(n)) return "CLAIM";
  if (/\b(no me interesa|no gracias|ya no quiero|cancelar|cancele|dejemos asi|dejemos así)\b/.test(n)) return "LOST";
  if (/\b(original|originales|imitacion|imitación|generico|genérico)\b/.test(n)) return "ORIGINALITY";
  if (/\b(no confio|no confío|estafa|seguro|seguridad|confianza)\b/.test(n)) return "TRUST";
  if (/\b(descuento|rebaja|mejora el precio|mejor precio|mayoreo|mayorista)\b/.test(n)) return "DISCOUNT";
  if (/\b(envio|envío|domicilio|contraentrega|pago en casa|pagar en casa|entrega|transportadora|flete)\b/.test(n)) return "SHIPPING";
  if (/\b(stock|disponible|disponibilidad|tienen|hay|existencia)\b/.test(n)) return "STOCK";
  if (/\b(precio|vale|cuanto|cuánto|costo|cotiza|cotización|cotizacion|valor)\b/.test(n)) return "PRICE";
  if (/\b(quiero|me interesa|mandeme|mándeme|envieme|envíeme|lo compro|comprar|pedido|programar|programame|prográmame|listo hagale|dale|separe|sepáreme)\b/.test(n)) return "BUY";
  if (/\b(hola|buenos dias|buenas tardes|buenas noches|informacion|información|info)\b/.test(n)) return "GREETING";
  return "INFO";
}

function descriptorsFromText(text: string): Descriptor[] {
  const n = normalizeAgentText(text);
  const descriptors: Descriptor[] = [];
  const duplex = n.match(/\b([23])\s*x\s*(10|12|14|16)\b/);
  if (duplex) descriptors.push({ kind: "duplex", value: `${duplex[1]}x${duplex[2]}` });
  const gauge = n.match(/(?:calibre\s*|#\s*)(8|10|12|14|16)\b/);
  if (gauge) descriptors.push({ kind: "gauge", value: gauge[1] });
  const watts = n.match(/\b(3|6|9|12|15|18|20|24|30|36|40|50)\s*w\b/);
  if (watts) descriptors.push({ kind: "watts", value: watts[1] });
  const amps = n.match(/\b(15|20|30|40|50|60)\s*a\b/);
  if (amps) descriptors.push({ kind: "amps", value: amps[1] });
  const circuits = n.match(/\b(2|4|6|8|12)\s*circuitos?\b/);
  if (circuits) descriptors.push({ kind: "circuits", value: circuits[1] });
  const dimension = n.match(/\b(2\s*x\s*4|4\s*x\s*4)\b/);
  if (dimension) descriptors.push({ kind: "dimension", value: dimension[1].replace(/\s/g, "") });
  const pipe = n.match(/\b(1\s*\/\s*2|3\s*\/\s*4)\b/);
  if (pipe) descriptors.push({ kind: "pipe", value: pipe[1].replace(/\s/g, "") });
  return descriptors;
}

function descriptorMatchesProduct(descriptor: Descriptor, productName: string, variantName?: string | null) {
  const raw = normalizeAgentText(`${productName} ${variantName || ""}`);
  const compact = raw.replace(/\s/g, "");
  if (descriptor.kind === "gauge") return new RegExp(`(?:#|calibre\\s*)${descriptor.value}\\b`).test(raw);
  if (descriptor.kind === "duplex") return compact.includes(descriptor.value);
  if (descriptor.kind === "watts") return new RegExp(`\\b${descriptor.value}\\s*w\\b`).test(raw);
  if (descriptor.kind === "amps") return new RegExp(`\\b${descriptor.value}\\s*a\\b`).test(raw);
  if (descriptor.kind === "circuits") return new RegExp(`\\b${descriptor.value}\\s*circuitos?\\b`).test(raw);
  if (descriptor.kind === "dimension") return compact.includes(descriptor.value);
  if (descriptor.kind === "pipe") return compact.includes(descriptor.value);
  return false;
}

function hasExplicitProductSignal(text: string) {
  const n = normalizeAgentText(text);
  if (descriptorsFromText(text).length) return true;
  return PRODUCT_FAMILIES.some((family) => family.query.some((word) => n.includes(normalizeAgentText(word)))) || /\bcable\b/.test(n);
}

function authenticityFromSpecs(specs: Array<{ key: string; value: string }>) {
  const claim = specs.find((spec) => ["brand_claim", "authenticity", "original_brand", "original"].includes(normalizeAgentText(spec.key)));
  if (!claim) return "UNKNOWN" as const;
  const value = normalizeAgentText(claim.value);
  if (/\b(original|si|sí|true|autentico|auténtico)\b/.test(value)) return "ORIGINAL" as const;
  if (/\b(generico|genérico|no|false|tipo)\b/.test(value)) return "GENERIC" as const;
  return "UNKNOWN" as const;
}

function requiresColor(productName: string, category: string, specs: Array<{ key: string; value: string }>) {
  const explicit = specs.find((spec) => normalizeAgentText(spec.key) === "requires_color");
  if (explicit) return /^(1|true|si|sí|yes)$/i.test(String(explicit.value).trim());
  const n = normalizeAgentText(productName);
  const c = normalizeAgentText(category);
  return c.includes("cables") && (/^alambre #/.test(n) || n.includes("7 hilos"));
}

function candidateLabel(choice: CatalogChoice) {
  return choice.variantName ? `${choice.productName} ${choice.variantName}` : choice.productName;
}

async function matchCatalog(text: string, previous: SalesAgentState): Promise<CatalogResult> {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    include: {
      variants: { where: { active: true }, orderBy: { order: "asc" } },
      brand: true,
      category: true,
      subcategory: true,
      specs: true,
    },
  });

  const n = normalizeAgentText(text);
  const descriptors = descriptorsFromText(text);
  const explicitSignal = hasExplicitProductSignal(text);
  const candidates: CatalogChoice[] = [];

  for (const product of products) {
    const productName = String(product.name || "");
    const baseText = normalizeAgentText(`${productName} ${product.category?.name || ""} ${product.subcategory?.name || ""} ${product.brand?.name || ""} ${product.sku || ""}`);
    let score = !explicitSignal && previous.productId === product.id ? 4 : 0;

    if (n.includes(normalizeAgentText(productName))) score += 12;
    if (n.includes(normalizeAgentText(product.sku))) score += 12;

    for (const family of PRODUCT_FAMILIES) {
      const queryHit = family.query.some((word) => n.includes(normalizeAgentText(word)));
      const productHit = family.product.some((word) => baseText.includes(normalizeAgentText(word)));
      if (queryHit && productHit) score += family.weight;
    }

    if (/\bcable\b/.test(n) && normalizeAgentText(product.category?.name).includes("cables")) score += 1.5;

    const variantOptions = product.variants.length ? product.variants : [null];
    for (const variant of variantOptions) {
      let variantScore = score;
      const displayText = normalizeAgentText(`${productName} ${variant?.name || ""}`);

      for (const descriptor of descriptors) {
        if (descriptorMatchesProduct(descriptor, productName, variant?.name)) variantScore += 5;
        else if (descriptor.kind !== "gauge") variantScore -= 1;
      }

      const meaningful = n.split(" ").filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
      for (const token of meaningful) if (displayText.includes(token)) variantScore += 0.7;

      if (!explicitSignal && previous.variantId && variant?.id === previous.variantId) variantScore += 2;
      if (variantScore < 3.5) continue;

      const specs = Array.isArray(product.specs) ? product.specs.map((spec: any) => ({ key: String(spec.key), value: String(spec.value) })) : [];
      const basePrice = variant ? Number(variant.price) : product.price !== null ? Number(product.price) : null;
      const promoPrice = variant?.promoPrice !== null && variant?.promoPrice !== undefined
        ? Number(variant.promoPrice)
        : product.promoPrice !== null && product.promoPrice !== undefined
          ? Number(product.promoPrice)
          : null;
      const price = promoPrice ?? basePrice;

      candidates.push({
        productId: product.id,
        variantId: variant?.id || null,
        sku: variant?.sku || product.sku,
        productName,
        variantName: variant?.name || null,
        unit: product.unit,
        price,
        basePrice,
        promoPrice,
        stock: variant ? Number(variant.stock) : Number(product.stock),
        brand: product.brand?.name || "",
        category: product.category?.name || "",
        requiresVariant: product.variants.length > 0 && !variant,
        requiresColor: requiresColor(productName, product.category?.name || "", specs),
        authenticity: authenticityFromSpecs(specs),
        score: variantScore,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0] || null;
  if (!top) return { choice: null, candidates: [], ambiguous: false };

  const close = candidates.filter((candidate) => candidate.productId !== top.productId && candidate.score >= top.score - 1.25).slice(0, 4);
  const ambiguous = close.length > 0 && explicitSignal;
  return { choice: ambiguous ? null : top, candidates: ambiguous ? [top, ...close].slice(0, 4) : [top], ambiguous };
}

function mergeState(text: string, lead: any, prior: SalesAgentState, choice: CatalogChoice | null, catalog: CatalogResult): SalesAgentState {
  const state: SalesAgentState = { ...prior };
  const qty = extractQuantity(text);
  const city = extractCity(text);
  const barrio = extractLabeled(text, ["barrio"]);
  const address = extractLabeled(text, ["direccion", "dirección", "dir"]);
  const name = extractLabeled(text, ["nombre"]);
  const color = extractColor(text);
  const customerType = extractCustomerType(text);
  const urgency = extractUrgency(text);

  if (qty && qty > 0) state.qty = qty;
  if (city) state.city = city;
  if (barrio) state.barrio = barrio;
  if (address) state.address = address;
  if (name) state.customerName = name;
  else if (!state.customerName && lead?.name) state.customerName = String(lead.name);
  if (color) state.color = color;
  if (customerType) state.customerType = customerType;
  if (urgency) state.urgency = urgency;

  if (catalog.ambiguous) {
    state.candidateProductIds = catalog.candidates.map((item) => item.productId);
    state.candidateLabels = catalog.candidates.map(candidateLabel);
  } else {
    delete state.candidateProductIds;
    delete state.candidateLabels;
  }

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

function missingQualificationFields(state: SalesAgentState, choice: CatalogChoice | null) {
  const missing: string[] = [];
  if (!choice) missing.push("producto");
  if (!state.qty) missing.push("cantidad");
  if (!state.city) missing.push("ciudad");
  if (!state.urgency) missing.push("urgencia");
  return missing;
}

function missingCloseFields(state: SalesAgentState, choice: CatalogChoice | null) {
  const missing: string[] = [];
  if (!choice) missing.push("producto");
  if (!state.qty) missing.push("cantidad");
  if (!state.city) missing.push("ciudad");
  if (!state.address) missing.push("dirección");
  if (!state.barrio) missing.push("barrio");
  if (choice?.requiresColor && !state.color) missing.push("color");
  return missing;
}

function oneQuestionForMissing(missing: string[]) {
  const names: Record<string, string> = {
    producto: "qué producto exacto necesitas",
    cantidad: "qué cantidad necesitas",
    ciudad: "para qué ciudad es",
    urgencia: "si lo necesitas hoy, mañana o puede esperar",
    dirección: "la dirección de entrega",
    barrio: "el barrio",
    color: "el color",
  };
  const parts = missing.map((item) => names[item] || item);
  if (parts.length === 1) return `¿Me confirmas ${parts[0]}?`;
  const last = parts.pop();
  return `¿Me confirmas ${parts.join(", ")} y ${last}?`;
}

function trimReply(text: string) {
  const words = text.trim().split(/\s+/);
  if (words.length <= SALES_AGENT_MAX_WORDS) return text.trim();
  return `${words.slice(0, SALES_AGENT_MAX_WORDS - 1).join(" ")}…`;
}

function publicProductLabel(choice: CatalogChoice) {
  return choice.variantName ? `${choice.productName} · ${choice.variantName}` : choice.productName;
}

function ambiguityQuestion(candidates: CatalogChoice[]) {
  const labels = candidates.map((item) => publicProductLabel(item)).slice(0, 4);
  if (!labels.length) return "¿Cuál es el producto exacto que necesitas?";
  if (labels.length === 1) return `¿Te refieres a ${labels[0]}?`;
  return `Para no cotizarte el producto equivocado, ¿cuál necesitas: ${labels.join(", ")}?`;
}

function nextStepState(state: SalesAgentState, nextStep: string, hours = SALES_AGENT_FOLLOW_UP_HOURS) {
  return {
    ...state,
    nextStep,
    nextStepAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
  };
}

function decision(input: Omit<AgentDecision, "reply"> & { reply: string }): AgentDecision {
  return { ...input, reply: trimReply(input.reply) };
}

function buildDecision(text: string, lead: any, intent: string, state: SalesAgentState, catalog: CatalogResult): AgentDecision {
  const choice = catalog.choice;
  const candidateSummary = catalog.candidates.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    price: item.price,
    stock: item.stock,
    unit: item.unit,
    score: item.score,
  }));

  if (catalog.ambiguous) {
    const nextState = nextStepState(state, "Cliente debe aclarar el producto exacto");
    return decision({
      reply: ambiguityQuestion(catalog.candidates), status: "CONTACTED", intent: "CLARIFY_PRODUCT", confidence: 0.96,
      needsHuman: false, cap: "A", state: nextState, action: "CLARIFY_PRODUCT", matchedProduct: null,
      candidates: candidateSummary, missingFields: ["producto"],
    });
  }

  if (intent === "HUMAN" || intent === "CLAIM") {
    return decision({
      reply: intent === "CLAIM"
        ? "Voy a pasar este caso a un asesor para revisarlo correctamente. Envíame el número de pedido y, si aplica, una foto del producto o daño."
        : "Te paso con un asesor para continuar. La conversación queda registrada para que no tengas que repetir la información.",
      status: lead?.status === "NEW" ? "CONTACTED" : (lead?.status || "CONTACTED"), intent, confidence: 1,
      needsHuman: true, cap: "HUMAN", state, action: "ESCALATE_HUMAN", matchedProduct: choice,
      candidates: candidateSummary, missingFields: [],
    });
  }

  if (intent === "LOST") {
    return decision({
      reply: "Entendido. Cierro el seguimiento para no insistir. Si más adelante necesitas material eléctrico, puedes escribirnos por este mismo chat.",
      status: "LOST", intent, confidence: 0.99, needsHuman: false, cap: "NONE",
      state: { ...state, awaitingConfirmation: false, nextStep: undefined, nextStepAt: undefined },
      action: "MARK_LOST", matchedProduct: choice, candidates: candidateSummary, missingFields: [],
    });
  }

  if (intent === "ORIGINALITY") {
    if (!choice || choice.authenticity === "UNKNOWN") {
      return decision({
        reply: "Quiero confirmarte ese dato correctamente y no asumirlo. Lo dejo para validación de un asesor antes de darte una respuesta sobre originalidad.",
        status: "CONTACTED", intent, confidence: 1, needsHuman: true, cap: "HUMAN", state,
        action: "VERIFY_AUTHENTICITY", matchedProduct: choice, candidates: candidateSummary, missingFields: [],
      });
    }
    const reply = choice.authenticity === "ORIGINAL"
      ? `${publicProductLabel(choice)} está registrado en el catálogo como producto original de ${choice.brand || "la marca indicada"}.`
      : `${publicProductLabel(choice)} está registrado como producto genérico/tipo marca; no se ofrece como original.`;
    return decision({
      reply, status: "CONTACTED", intent, confidence: 1, needsHuman: false, cap: "A",
      state: nextStepState(state, "Continuar calificación comercial"), action: "ANSWER_AUTHENTICITY",
      matchedProduct: choice, candidates: candidateSummary, missingFields: missingQualificationFields(state, choice),
    });
  }

  if (intent === "DISCOUNT") {
    if (!choice) {
      return decision({
        reply: "Los descuentos dependen del producto y la cantidad. No invento descuentos ni modifico precios. ¿Qué producto y cantidad necesitas?",
        status: "CONTACTED", intent, confidence: 0.95, needsHuman: false, cap: "A",
        state: nextStepState(state, "Cliente debe indicar producto y cantidad"), action: "ASK_DISCOUNT_CONTEXT",
        matchedProduct: null, candidates: candidateSummary, missingFields: ["producto", "cantidad"],
      });
    }
    if (choice.promoPrice != null) {
      return decision({
        reply: `${publicProductLabel(choice)} tiene precio promocional activo de ${formatCOP(choice.promoPrice)} por ${choice.unit}. Para cotizar completo, ${oneQuestionForMissing(missingQualificationFields(state, choice))}`,
        status: "CONTACTED", intent, confidence: 0.98, needsHuman: false, cap: "A",
        state: nextStepState(state, "Completar datos para cotización"), action: "PROMO_PRICE",
        matchedProduct: choice, candidates: candidateSummary, missingFields: missingQualificationFields(state, choice),
      });
    }
    return decision({
      reply: `${publicProductLabel(choice)} no tiene una promoción cargada en el sistema. No puedo ofrecer un descuento no autorizado; si necesitas negociación especial, lo paso a un asesor.`,
      status: "CONTACTED", intent, confidence: 0.99, needsHuman: true, cap: "HUMAN", state,
      action: "DISCOUNT_REQUIRES_HUMAN", matchedProduct: choice, candidates: candidateSummary, missingFields: [],
    });
  }

  if (intent === "TRUST") {
    const missing = missingQualificationFields(state, choice);
    const suffix = missing.length ? ` ${oneQuestionForMissing(missing)}` : " ¿Quieres que avancemos con la cotización completa?";
    return decision({
      reply: `Manejamos pago en casa / contraentrega cuando la transportadora y el destino lo permiten. Confirmamos producto, cantidades, envío y total antes del despacho.${suffix}`,
      status: "CONTACTED", intent, confidence: 0.97, needsHuman: false, cap: "A",
      state: nextStepState(state, "Continuar calificación y cotización"), action: "ANSWER_TRUST",
      matchedProduct: choice, candidates: candidateSummary, missingFields: missing,
    });
  }

  if (state.awaitingConfirmation && intent === "CONFIRM" && choice) {
    const missing = missingCloseFields(state, choice);
    if (!missing.length) {
      const subtotal = choice.price && state.qty ? choice.price * state.qty : null;
      return decision({
        reply: `Confirmado. Queda POR CERRAR: ${publicProductLabel(choice)}, ${state.qty} ${choice.unit}${state.color ? `, ${state.color}` : ""}, ${state.city}, ${state.barrio}. ${subtotal ? `Producto: ${formatCOP(subtotal)}. ` : ""}Un asesor valida envío y programación antes de generar la guía.`,
        status: "NEGOTIATION", intent, confidence: 0.99, needsHuman: true, cap: "C",
        state: { ...state, awaitingConfirmation: false }, action: "READY_TO_CLOSE", matchedProduct: choice,
        candidates: candidateSummary, missingFields: [],
      });
    }
  }

  if (!choice) {
    const missing = missingQualificationFields(state, null);
    return decision({
      reply: `Te ayudo con el pedido. ${oneQuestionForMissing(missing)}`,
      status: "CONTACTED", intent, confidence: 0.78, needsHuman: false, cap: "A",
      state: nextStepState(state, "Completar calificación: producto, cantidad, ciudad y urgencia"), action: "QUALIFY",
      matchedProduct: null, candidates: candidateSummary, missingFields: missing,
    });
  }

  if (state.qty && choice.stock < state.qty) {
    return decision({
      reply: `${publicProductLabel(choice)} tiene ${choice.stock} ${choice.unit} disponibles y necesitas ${state.qty}. No voy a prometer inventario que no existe; lo paso a un asesor para validar reposición o alternativa.`,
      status: "NEGOTIATION", intent, confidence: 0.99, needsHuman: true, cap: "HUMAN", state,
      action: "STOCK_SHORTAGE", matchedProduct: choice, candidates: candidateSummary, missingFields: [],
    });
  }

  const missingQualification = missingQualificationFields(state, choice);
  const unitPrice = choice.price != null ? `${formatCOP(choice.price)} por ${choice.unit}` : "precio pendiente de validación";
  const subtotal = choice.price != null && state.qty ? choice.price * state.qty : null;

  if (intent === "PRICE" || intent === "STOCK" || intent === "SHIPPING" || intent === "INFO" || intent === "GREETING") {
    if (missingQualification.length) {
      const intro = intent === "STOCK"
        ? `${publicProductLabel(choice)}: stock registrado ${choice.stock} ${choice.unit}.`
        : intent === "SHIPPING"
          ? "El envío se cotiza con el destino y el paquete; no doy un valor estimado inventado."
          : `${publicProductLabel(choice)}: ${unitPrice}.`;
      return decision({
        reply: `${intro} Para completar la cotización, ${oneQuestionForMissing(missingQualification)}`,
        status: "CONTACTED", intent, confidence: Math.min(0.99, 0.82 + choice.score / 30), needsHuman: choice.price == null,
        cap: choice.price == null ? "HUMAN" : "A", state: nextStepState(state, "Completar datos para cotización"),
        action: choice.price == null ? "PRICE_REQUIRES_HUMAN" : "QUALIFY_BEFORE_QUOTE", matchedProduct: choice,
        candidates: candidateSummary, missingFields: missingQualification,
      });
    }

    return decision({
      reply: `${publicProductLabel(choice)}: ${state.qty} ${choice.unit} × ${formatCOP(choice.price || 0)} = ${subtotal != null ? formatCOP(subtotal) : "—"}. Stock: ${choice.stock}. Falta calcular el envío para darte el total contraentrega; no marco como COTIZADO hasta tenerlo.`,
      status: "CONTACTED", intent, confidence: 0.98, needsHuman: false, cap: "A",
      state: nextStepState(state, "Calcular envío y completar cotización"), action: "QUOTE_PENDING_SHIPPING",
      matchedProduct: choice, candidates: candidateSummary, missingFields: ["envío"],
    });
  }

  if (intent === "BUY") {
    if (missingQualification.length) {
      return decision({
        reply: `${publicProductLabel(choice)} está disponible a ${unitPrice}. Para avanzar, ${oneQuestionForMissing(missingQualification)}`,
        status: "NEGOTIATION", intent, confidence: 0.96, needsHuman: false, cap: "A",
        state: nextStepState(state, "Completar calificación antes de cierre"), action: "COLLECT_QUALIFICATION",
        matchedProduct: choice, candidates: candidateSummary, missingFields: missingQualification,
      });
    }

    const missingClose = missingCloseFields(state, choice);
    if (missingClose.length) {
      return decision({
        reply: `${publicProductLabel(choice)}: ${state.qty} ${choice.unit}, subtotal ${subtotal != null ? formatCOP(subtotal) : "por validar"}. Para dejar el pedido listo, ${oneQuestionForMissing(missingClose)}`,
        status: "NEGOTIATION", intent, confidence: 0.97, needsHuman: false, cap: "A",
        state: nextStepState(state, "Cliente debe completar datos de cierre"), action: "COLLECT_CLOSE_DATA",
        matchedProduct: choice, candidates: candidateSummary, missingFields: missingClose,
      });
    }

    const summary = `${publicProductLabel(choice)}, ${state.qty} ${choice.unit}${state.color ? `, ${state.color}` : ""}, ${state.city}, ${state.barrio}, ${state.address}`;
    return decision({
      reply: `Tengo: ${summary}. Producto: ${subtotal != null ? formatCOP(subtotal) : "por validar"}; envío aún por validar. ¿Confirmas estos datos para dejarlo POR CERRAR?`,
      status: "NEGOTIATION", intent, confidence: 0.99, needsHuman: false, cap: "A",
      state: nextStepState({ ...state, awaitingConfirmation: true }, "Cliente debe confirmar datos de cierre"),
      action: "REQUEST_CONFIRMATION", matchedProduct: choice, candidates: candidateSummary, missingFields: ["confirmación"],
    });
  }

  const missing = missingQualificationFields(state, choice);
  return decision({
    reply: missing.length
      ? `${publicProductLabel(choice)}: ${unitPrice}. Para seguir, ${oneQuestionForMissing(missing)}`
      : `${publicProductLabel(choice)}: ${unitPrice}. Tengo producto, cantidad, ciudad y urgencia; el siguiente paso es calcular el envío para completar la cotización.`,
    status: "CONTACTED", intent, confidence: 0.9, needsHuman: choice.price == null, cap: choice.price == null ? "HUMAN" : "A",
    state: nextStepState(state, missing.length ? "Completar calificación" : "Calcular envío"),
    action: missing.length ? "QUALIFY" : "QUOTE_PENDING_SHIPPING", matchedProduct: choice, candidates: candidateSummary,
    missingFields: missing.length ? missing : ["envío"],
  });
}

export async function evaluateSalesAgent(input: { text: string; state?: SalesAgentState; lead?: any }) {
  const text = String(input.text || "").trim();
  if (!text) throw new Error("Escribe un mensaje para evaluar el agente");
  if (text.length > 4000) {
    const state = input.state || {};
    const result: AgentDecision = {
      reply: "Tu mensaje es largo y quiero revisarlo sin omitir detalles. Lo paso a un asesor para atención humana.",
      status: "CONTACTED", intent: "LONG_MESSAGE", confidence: 1, needsHuman: true, cap: "HUMAN", state,
      action: "ESCALATE_LONG_MESSAGE", matchedProduct: null, candidates: [], missingFields: [],
    };
    return { version: SALES_AGENT_VERSION, decision: result };
  }

  const prior = input.state && typeof input.state === "object" ? input.state : {};
  const catalog = await matchCatalog(text, prior);
  const state = mergeState(text, input.lead || {}, prior, catalog.choice, catalog);
  const intent = detectIntent(text, state);
  const result = buildDecision(text, input.lead || {}, intent, state, catalog);
  return { version: SALES_AGENT_VERSION, decision: result };
}

export const SALES_AGENT_STRATEGY = {
  engine: "deterministic_rules_no_llm",
  version: SALES_AGENT_VERSION,
  language: {
    tone: "profesional, cercano, claro, consultivo, natural, seguro y breve",
    maxWords: SALES_AGENT_MAX_WORDS,
    maxQuestions: 1,
    emojis: "0 por defecto; máximo 1 si se habilita manualmente",
    forbiddenInternalTerms: ["lead", "funnel", "scoring", "pipeline", "conversión multietapa"],
  },
  qualification: ["producto exacto", "cantidad", "ciudad", "urgencia"],
  quote: ["producto", "cantidad", "precio unitario", "subtotal", "envío", "total contraentrega"],
  close: ["producto", "cantidad", "color cuando aplica", "dirección", "barrio", "confirmación expresa"],
  cap: {
    C: "cliente listo: POR-CERRAR; validar envío/programación; nunca generar guía sin confirmación",
    A: "hay un siguiente paso concreto; registrar qué falta y cuándo revisar",
    P: "sin respuesta: secuencia máxima mensaje → llamada → último mensaje",
  },
  pricing: "usa promoPrice si existe; de lo contrario price; nunca inventa descuentos",
  safetyFilters: ["duplicados", "mensajes no texto", "reclamos", "solicitud humana", "stock insuficiente", "originalidad no verificada", "precio no cargado", "producto ambiguo"],
};
