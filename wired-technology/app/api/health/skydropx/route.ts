import { NextResponse } from "next/server";
import { getSkydropxHealth } from "@/lib/skydropx-bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getSkydropxHealth();
    return NextResponse.json({ ok: true, connected: result.connected === true, provider: "skydropx" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, connected: false, provider: "skydropx", error: error?.message || "connection_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
