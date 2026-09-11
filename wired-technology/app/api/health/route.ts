import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    const response = NextResponse.json(
      {
        status: "ok",
        service: "wired-technology",
        database: "ok",
        latencyMs: Date.now() - startedAt,
        revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("[HEALTH] Database check failed", error);
    const response = NextResponse.json(
      {
        status: "degraded",
        service: "wired-technology",
        database: "unavailable",
        latencyMs: Date.now() - startedAt,
        revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
