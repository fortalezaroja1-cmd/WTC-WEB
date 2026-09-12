import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

export type MetaChannel = "WHATSAPP" | "MESSENGER" | "INSTAGRAM";

export type MetaConnectionSummary = {
  id: string;
  channel: MetaChannel;
  externalAccountId: string;
  externalParentId: string | null;
  accountName: string | null;
  username: string | null;
  status: string;
  tokenExpiresAt: Date | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export function metaGraphVersion() {
  return process.env.META_GRAPH_VERSION || "v26.0";
}

export function publicBaseUrl(fallbackOrigin?: string) {
  const configured = String(
    process.env.META_OAUTH_REDIRECT_BASE ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      fallbackOrigin ||
      ""
  ).trim();
  if (!configured) return "";
  const url = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  return url.replace(/\/$/, "");
}

export function metaEnvStatus(origin?: string) {
  const base = publicBaseUrl(origin);
  const facebookAppId = process.env.META_APP_ID?.trim() || "";
  const instagramAppId = process.env.META_INSTAGRAM_APP_ID?.trim() || facebookAppId;
  const appSecret = process.env.META_APP_SECRET?.trim() || "";
  const instagramSecret = process.env.META_INSTAGRAM_APP_SECRET?.trim() || appSecret;
  const whatsappConfigId = process.env.META_WHATSAPP_CONFIG_ID?.trim() || "";

  return {
    graphVersion: metaGraphVersion(),
    baseUrl: base,
    facebook: {
      ready: Boolean(facebookAppId && appSecret && base),
      appId: facebookAppId || null,
      callbackUrl: base ? `${base}/api/admin/integrations/meta/facebook/callback` : null,
      missing: [!facebookAppId && "META_APP_ID", !appSecret && "META_APP_SECRET", !base && "META_OAUTH_REDIRECT_BASE"].filter(Boolean),
    },
    instagram: {
      ready: Boolean(instagramAppId && instagramSecret && base),
      appId: instagramAppId || null,
      callbackUrl: base ? `${base}/api/admin/integrations/meta/instagram/callback` : null,
      missing: [!instagramAppId && "META_INSTAGRAM_APP_ID/META_APP_ID", !instagramSecret && "META_INSTAGRAM_APP_SECRET/META_APP_SECRET", !base && "META_OAUTH_REDIRECT_BASE"].filter(Boolean),
    },
    whatsapp: {
      ready: Boolean(facebookAppId && appSecret && whatsappConfigId && base),
      appId: facebookAppId || null,
      configId: whatsappConfigId || null,
      missing: [!facebookAppId && "META_APP_ID", !appSecret && "META_APP_SECRET", !whatsappConfigId && "META_WHATSAPP_CONFIG_ID", !base && "META_OAUTH_REDIRECT_BASE"].filter(Boolean),
    },
  };
}

export async function listMetaConnections(): Promise<MetaConnectionSummary[]> {
  return prisma.$queryRawUnsafe<MetaConnectionSummary[]>(`
    SELECT "id", "channel", "externalAccountId", "externalParentId", "accountName", "username",
           "status", "tokenExpiresAt", "scopes", "metadata", "createdAt", "updatedAt"
    FROM "MetaConnection"
    ORDER BY "channel", "updatedAt" DESC
  `);
}

export async function saveMetaConnection(input: {
  channel: MetaChannel;
  externalAccountId: string;
  externalParentId?: string | null;
  accountName?: string | null;
  username?: string | null;
  accessToken: string;
  tokenExpiresAt?: Date | null;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();
  const metadata = JSON.stringify(input.metadata || {});
  const scopes = input.scopes || [];

  await prisma.$executeRawUnsafe(
    `INSERT INTO "MetaConnection" (
      "id","channel","externalAccountId","externalParentId","accountName","username","status",
      "tokenCiphertext","tokenExpiresAt","scopes","metadata","createdAt","updatedAt"
    ) VALUES (
      $1,$2,$3,$4,$5,$6,'CONNECTED',
      extensions.pgp_sym_encrypt($7, (SELECT "value" FROM "SystemSecret" WHERE "key"='meta_token_key')),
      $8,$9,$10::jsonb,NOW(),NOW()
    )
    ON CONFLICT ("channel","externalAccountId") DO UPDATE SET
      "externalParentId"=EXCLUDED."externalParentId",
      "accountName"=EXCLUDED."accountName",
      "username"=EXCLUDED."username",
      "status"='CONNECTED',
      "tokenCiphertext"=EXCLUDED."tokenCiphertext",
      "tokenExpiresAt"=EXCLUDED."tokenExpiresAt",
      "scopes"=EXCLUDED."scopes",
      "metadata"=EXCLUDED."metadata",
      "updatedAt"=NOW()`,
    id,
    input.channel,
    input.externalAccountId,
    input.externalParentId || null,
    input.accountName || null,
    input.username || null,
    input.accessToken,
    input.tokenExpiresAt || null,
    scopes,
    metadata,
  );
}

export async function getMetaConnectionToken(channel: MetaChannel, externalAccountId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ token: string }>>(
    `SELECT extensions.pgp_sym_decrypt("tokenCiphertext", (SELECT "value" FROM "SystemSecret" WHERE "key"='meta_token_key'))::text AS "token"
     FROM "MetaConnection" WHERE "channel"=$1 AND "externalAccountId"=$2 AND "status"='CONNECTED' LIMIT 1`,
    channel,
    externalAccountId,
  );
  return rows[0]?.token || null;
}

export async function disconnectMetaConnection(id: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "MetaConnection" SET "status"='DISCONNECTED', "tokenCiphertext"=NULL, "updatedAt"=NOW() WHERE "id"=$1`,
    id,
  );
}

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || data?.error_description || `Meta respondió ${response.status}`);
  }
  return data;
}

export async function exchangeFacebookCode(code: string, redirectUri: string) {
  const clientId = process.env.META_APP_ID?.trim();
  const clientSecret = process.env.META_APP_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Faltan META_APP_ID o META_APP_SECRET");

  const url = new URL(`https://graph.facebook.com/${metaGraphVersion()}/oauth/access_token`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  return jsonFetch(url.toString());
}

export async function fetchFacebookPages(userToken: string) {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion()}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,tasks,instagram_business_account{id,username,name}");
  url.searchParams.set("access_token", userToken);
  const data = await jsonFetch(url.toString());
  return Array.isArray(data?.data) ? data.data : [];
}

export async function subscribeFacebookPage(pageId: string, pageToken: string) {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion()}/${pageId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "messages,messaging_postbacks,message_deliveries,message_reads");
  url.searchParams.set("access_token", pageToken);
  return jsonFetch(url.toString(), { method: "POST" });
}

export async function exchangeInstagramCode(code: string, redirectUri: string) {
  const clientId = process.env.META_INSTAGRAM_APP_ID?.trim() || process.env.META_APP_ID?.trim();
  const clientSecret = process.env.META_INSTAGRAM_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Faltan las credenciales de Instagram/Meta");

  const form = new URLSearchParams();
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", redirectUri);
  form.set("code", code);
  return jsonFetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

export async function fetchInstagramProfile(accessToken: string) {
  const url = new URL("https://graph.instagram.com/me");
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", accessToken);
  return jsonFetch(url.toString());
}

export async function exchangeWhatsAppEmbeddedCode(code: string) {
  const clientId = process.env.META_APP_ID?.trim();
  const clientSecret = process.env.META_APP_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Faltan META_APP_ID o META_APP_SECRET");

  const url = new URL(`https://graph.facebook.com/${metaGraphVersion()}/oauth/access_token`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("code", code);
  return jsonFetch(url.toString());
}

export async function subscribeWhatsAppWaba(wabaId: string, accessToken: string) {
  const url = `https://graph.facebook.com/${metaGraphVersion()}/${wabaId}/subscribed_apps`;
  return jsonFetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function fetchWhatsAppPhone(phoneNumberId: string, accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion()}/${phoneNumberId}`);
  url.searchParams.set("fields", "id,display_phone_number,verified_name,quality_rating");
  url.searchParams.set("access_token", accessToken);
  return jsonFetch(url.toString());
}
