const SUPABASE_FUNCTION_URL = "https://klfomayggscumxevsfgp.supabase.co/functions/v1/skydropx-quote";
const SUPABASE_ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZm9tYXlnZ3NjdW14ZXZzZmdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTM1MjAsImV4cCI6MjEwMTM2OTUyMH0.dpQoNlHmUujcGSE7kkaUffke0qd8xD-q5rCLfUvjTIc";

export type SkydropxRate = {
  id: string | null;
  carrier: string | null;
  service: string | null;
  price: number | null;
  currency: string | null;
  days: number | string | null;
  shipment_creation_type: string | null;
};

async function callBridge(payload: Record<string, unknown>) {
  const response = await fetch(SUPABASE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_JWT}`,
      "apikey": SUPABASE_ANON_JWT,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || data?.message || `Skydropx bridge respondió ${response.status}`;
    const error = new Error(message) as Error & { status?: number; details?: unknown };
    error.status = response.status;
    error.details = data?.details || data;
    throw error;
  }
  return data;
}

export async function getSkydropxHealth() {
  return callBridge({ action: "health" }) as Promise<{
    ok: boolean;
    connected: boolean;
    provider: string;
    scope?: string | null;
    token_expires_at?: string | null;
    credentials_present?: boolean;
  }>;
}

export async function createSkydropxQuote(quotation: Record<string, unknown>) {
  return callBridge({ action: "quote", quotation }) as Promise<{
    ok: boolean;
    quotation_id: string | null;
    is_completed: boolean;
    rates: SkydropxRate[];
    best_rate: SkydropxRate | null;
  }>;
}

export async function getSkydropxQuotation(id: string) {
  return callBridge({ action: "get_quotation", id }) as Promise<{
    ok: boolean;
    quotation: unknown;
    rates: SkydropxRate[];
  }>;
}
