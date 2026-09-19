import { NextRequest, NextResponse } from "next/server";
import { simulateSalesAgent, type SalesAgentSimulationState } from "@/lib/sales-agent-simulator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const state = body?.state && typeof body.state === "object" ? body.state as SalesAgentSimulationState : undefined;
    if (!text) return NextResponse.json({ error: "Escribe un mensaje" }, { status: 400 });
    const result = await simulateSalesAgent({ text, state });
    return NextResponse.json({ ok: true, reply: result.decision.reply, state: result.decision.state, decision: result.decision }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("[WIRED_ASSISTANT]", error);
    return NextResponse.json({ error: error?.message || "No se pudo ejecutar el asistente" }, { status: 500 });
  }
}