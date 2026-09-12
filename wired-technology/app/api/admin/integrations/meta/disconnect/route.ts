import { NextRequest, NextResponse } from "next/server";
import { disconnectMetaConnection } from "@/lib/meta-integrations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Falta id de conexión" }, { status: 400 });
    await disconnectMetaConnection(id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[META_DISCONNECT]", error);
    return NextResponse.json({ error: error?.message || "No se pudo desconectar" }, { status: 500 });
  }
}
