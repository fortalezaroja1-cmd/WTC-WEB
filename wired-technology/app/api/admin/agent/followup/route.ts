import { NextResponse } from "next/server";
import { runSalesFollowups } from "@/lib/sales-followup";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await runSalesFollowups();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("[SALES_FOLLOWUP_ADMIN]", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo ejecutar el seguimiento" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
