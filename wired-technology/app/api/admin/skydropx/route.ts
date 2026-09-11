import { NextRequest, NextResponse } from "next/server";
import { createSkydropxQuote, getSkydropxHealth, getSkydropxQuotation } from "@/lib/skydropx-bridge";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "health");

    if (action === "health") {
      const result = await getSkydropxHealth();
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "quote") {
      if (!body?.quotation || typeof body.quotation !== "object") {
        return NextResponse.json({ error: "Falta quotation" }, { status: 400 });
      }
      const result = await createSkydropxQuote(body.quotation);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "get_quotation") {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
      const result = await getSkydropxQuotation(id);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (error: any) {
    console.error("[SKYDROPX_ADMIN]", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo consultar Skydropx", details: error?.details || null },
      { status: error?.status || 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
