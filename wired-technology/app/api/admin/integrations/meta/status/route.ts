import { NextRequest, NextResponse } from "next/server";
import { listMetaConnections, metaEnvStatus } from "@/lib/meta-integrations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const connections = await listMetaConnections();
    const env = metaEnvStatus(new URL(request.url).origin);
    return NextResponse.json({ ok: true, env, connections }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("[META_INTEGRATIONS_STATUS]", error);
    return NextResponse.json({ error: error?.message || "No se pudo cargar el estado de Meta" }, { status: 500 });
  }
}
