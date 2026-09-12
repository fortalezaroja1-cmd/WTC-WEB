import type { SalesAgentState } from "@/lib/sales-agent-core";

const GENERIC = new Set([
  "el", "la", "los", "las", "un", "una", "de", "del", "para", "por", "quiero", "necesito",
  "precio", "stock", "cable", "producto", "ese", "esa", "este", "esta", "me", "dame", "seria", "sería",
]);

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(text: string) {
  return normalize(text)
    .split(" ")
    .filter((token) => token && !GENERIC.has(token));
}

/**
 * If the previous turn left a short list of product candidates, a clarification
 * such as "7 hilos" or "alambre" should resolve against that list instead of
 * starting catalog matching from zero. We append the uniquely matched label so
 * the shared core receives explicit product context. If it is still ambiguous,
 * the original text is kept and the core will ask again.
 */
export function enrichAgentTextFromContext(text: string, state?: SalesAgentState) {
  const labels = Array.isArray(state?.candidateLabels)
    ? state!.candidateLabels!.map(String).filter(Boolean)
    : [];
  if (labels.length < 2) return text;

  const tokens = meaningfulTokens(text);
  if (!tokens.length) return text;

  const matches = labels.filter((label) => {
    const normalized = normalize(label);
    return tokens.every((token) => normalized.includes(token));
  });

  if (matches.length !== 1) return text;
  return `${text}\n${matches[0]}`;
}
