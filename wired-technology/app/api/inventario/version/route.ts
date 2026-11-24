import { NextResponse } from "next/server";
import { centralStockEnabled, stockVersion } from "@/lib/trefi-stock";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!centralStockEnabled()) return NextResponse.json({ version: "local" });
  try {
    return NextResponse.json(
      { version: await stockVersion() },
      {
        headers: {
          "Cache-Control": "public, max-age=0",
          "Vercel-CDN-Cache-Control": "public, s-maxage=2",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Disponibilidad en verificación." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
