import { NextRequest, NextResponse } from "next/server";
import { runSalesFollowups } from "@/lib/sales-followup";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await runSalesFollowups();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("[SALES_FOLLOWUP_CRON]", error);
    return NextResponse.json({ error: error?.message || "No se pudo ejecutar seguimiento" }, { status: 500 });
  }
}
