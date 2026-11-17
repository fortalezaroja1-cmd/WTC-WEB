import { createHmac, timingSafeEqual } from "node:crypto";

const BASE_URL = process.env.IION_API_BASE_URL?.trim() || "https://api.prod.iionpay.com/api/v1";

export type IionCollect = {
  id: string;
  reference: string;
  amount: number;
  baseAmount?: number;
  feeAmount?: number;
  currency: string;
  status: string;
  collectUrl: string;
  expiresAt: string;
};

function credentials() {
  const key = process.env.IION_API_KEY?.trim();
  const secret = process.env.IION_API_SECRET?.trim();
  if (!key || !secret) throw new Error("IION_NOT_CONFIGURED");
  return { key, secret };
}

export async function createIionCollect(input: {
  reference: string;
  amount: number;
  description: string;
  customerName?: string | null;
  customerEmail?: string | null;
  metadata: Record<string, string>;
  idempotencyKey: string;
}) {
  const { key, secret } = credentials();
  const callbackUrl = process.env.IION_CATALOG_RETURN_URL?.trim();
  const response = await fetch(`${BASE_URL}/collect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": key,
      "X-Api-Secret": secret,
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      reference: input.reference,
      amount: input.amount,
      currency: "COP",
      country: "CO",
      description: input.description,
      customerName: input.customerName || undefined,
      customerEmail: input.customerEmail || undefined,
      expirationMinutes: 1440,
      callbackUrl: callbackUrl || undefined,
      metadata: input.metadata,
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data?.collectUrl) {
    console.error("[iion] collect failed", response.status, payload?.error?.code || payload?.message || "unknown");
    throw new Error("IION_COLLECT_FAILED");
  }
  return payload.data as IionCollect;
}

export function verifyIionWebhook(raw: string, headers: Headers) {
  const secret = process.env.IION_WEBHOOK_SECRET?.trim();
  const signature = headers.get("x-iion-signature") || headers.get("x-niio-signature") || "";
  const timestamp = headers.get("x-iion-timestamp") || headers.get("x-niio-timestamp") || "";
  if (!secret || !signature || !/^\d+$/.test(timestamp)) return false;
  const age = Math.abs(Date.now() - Number(timestamp));
  if (age > 5 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const received = signature.replace(/^sha256=/, "");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(received, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
