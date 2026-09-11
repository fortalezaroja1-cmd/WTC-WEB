import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const checks = {
    database: false,
    jwtSecret: configured("JWT_SECRET"),
    databaseUrl: configured("DATABASE_URL"),
    directUrl: configured("DIRECT_URL"),
    supabaseUrl: configured("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: configured("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    metaAccessToken: configured("META_WHATSAPP_ACCESS_TOKEN"),
    metaPhoneNumberId: configured("META_WHATSAPP_PHONE_NUMBER_ID"),
    metaWebhookVerifyToken: configured("META_WEBHOOK_VERIFY_TOKEN"),
    metaAppSecret: configured("META_APP_SECRET"),
  };

  let databaseError: string | null = null;
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message.slice(0, 200) : "Database unavailable";
  }

  const criticalReady = checks.database && checks.jwtSecret && checks.databaseUrl;
  const metaReady =
    checks.metaAccessToken &&
    checks.metaWebhookVerifyToken &&
    checks.metaPhoneNumberId &&
    checks.metaAppSecret;

  const response = NextResponse.json(
    {
      status: criticalReady ? "ready" : "not_ready",
      checks,
      integrations: {
        metaWhatsApp: metaReady ? "ready" : "incomplete",
      },
      databaseError,
      latencyMs: Date.now() - startedAt,
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      timestamp: new Date().toISOString(),
    },
    { status: criticalReady ? 200 : 503 }
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
