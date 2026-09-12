import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSalesFollowups } from "@/lib/sales-followup";

export const dynamic = "force-dynamic";

async function handler(request: NextRequest) {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
      `SELECT "value" FROM "SystemSecret" WHERE "key"='sales_followup_cron' LIMIT 1`,
    );
    const secret = rows[0]?.value;
    if (!secret || request.headers.get("x-crm-cron-secret") !== secret) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const result = await runSalesFollowups();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("[SALES_FOLLOWUP_CRON]", error);
    return NextResponse.json({ error: error?.message || "No se pudo ejecutar seguimiento" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
