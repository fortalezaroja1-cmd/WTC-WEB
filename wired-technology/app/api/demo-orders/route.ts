import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = body.items;
    const requestId = String(body.requestId || "").trim().slice(0, 100);

    if (!requestId || !Array.isArray(items) || !items.length || items.length > 100) {
      return NextResponse.json({ error: "Datos de demostración incompletos" }, { status: 400 });
    }

    const productIds = [...new Set(items.map((item: any) => String(item.productId || "")).filter(Boolean))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: "PUBLISHED" },
      select: {
        id: true,
        price: true,
        stock: true,
        variants: { where: { active: true }, select: { id: true, price: true, stock: true } },
      },
    });
    const productById = new Map(products.map(product => [product.id, product]));
    const subtotal = items.reduce((sum: number, item: any) => {
      const product = productById.get(String(item.productId || ""));
      const qty = Number(item.qty);
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 999) throw new Error("INVALID_ITEM");
      const variantId = item.variantId ? String(item.variantId) : null;
      const variant = variantId ? product.variants.find(candidate => candidate.id === variantId) : null;
      if ((variantId && !variant) || (!variantId && product.variants.length)) throw new Error("INVALID_ITEM");
      const stock = variant ? variant.stock : product.stock;
      const price = Number(variant ? variant.price : product.price);
      if (stock < qty || !Number.isFinite(price) || price <= 0) throw new Error("INVALID_ITEM");
      return sum + price * qty;
    }, 0);

    const suffix = requestId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
    // No escribe en ninguna tabla, no crea notificaciones y no toca inventario ni CRM.
    return NextResponse.json({
      orderNumber: `WT-DEMO-${suffix}`,
      orderId: `demo:${requestId}`,
      subtotal,
      simulation: true,
    });
  } catch (error: any) {
    if (error?.message === "INVALID_ITEM") {
      return NextResponse.json({ error: "Actualiza el carrito para continuar con la demostración." }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo preparar la demostración" }, { status: 500 });
  }
}

