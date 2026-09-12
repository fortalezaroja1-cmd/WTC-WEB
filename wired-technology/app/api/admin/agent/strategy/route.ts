import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SALES_AGENT_STRATEGY, SALES_AGENT_VERSION } from "@/lib/sales-agent-core";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        promoPrice: true,
        variants: {
          where: { active: true },
          select: { id: true, name: true, sku: true, price: true, promoPrice: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const promotions: Array<{ product: string; sku: string; regular: number | null; promo: number }> = [];
    for (const product of products) {
      if (product.promoPrice != null) {
        promotions.push({ product: product.name, sku: product.sku, regular: product.price == null ? null : Number(product.price), promo: Number(product.promoPrice) });
      }
      for (const variant of product.variants) {
        if (variant.promoPrice != null) {
          promotions.push({
            product: `${product.name} · ${variant.name}`,
            sku: variant.sku,
            regular: Number(variant.price),
            promo: Number(variant.promoPrice),
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      version: SALES_AGENT_VERSION,
      strategy: SALES_AGENT_STRATEGY,
      pricing: {
        publishedProducts: products.length,
        activePromotions: promotions.length,
        promotions,
        rule: "promoPrice tiene prioridad cuando existe; si no, se usa price. El agente nunca inventa descuentos.",
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[AGENT_STRATEGY]", error);
    return NextResponse.json({ error: "No se pudo cargar la estrategia del agente" }, { status: 500 });
  }
}
