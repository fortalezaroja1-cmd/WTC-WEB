import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  productId: string;
  variantId: string | null;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  unitsPerPackage: number;
  maxUnitsPerPackage: number | null;
  active: boolean;
};

export async function GET() {
  try {
    const [products, profiles] = await Promise.all([
      prisma.product.findMany({
        where: { status: "PUBLISHED" },
        include: {
          variants: { where: { active: true }, orderBy: { order: "asc" } },
          brand: true,
          category: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.$queryRawUnsafe<ProfileRow[]>(`
        SELECT "id", "productId", "variantId", "weightKg", "lengthCm", "widthCm", "heightCm",
               "unitsPerPackage", "maxUnitsPerPackage", "active"
        FROM "ShippingProfile"
        ORDER BY "productId", "variantId"
      `),
    ]);

    const profileByKey = new Map(profiles.map((profile) => [`${profile.productId}:${profile.variantId || "BASE"}`, profile]));
    const rows: any[] = [];

    for (const product of products) {
      if (product.variants.length) {
        for (const variant of product.variants) {
          rows.push({
            productId: product.id,
            productName: product.name,
            variantId: variant.id,
            variantName: variant.name,
            sku: variant.sku,
            unit: product.unit,
            category: product.category?.name || "",
            brand: product.brand?.name || "",
            profile: profileByKey.get(`${product.id}:${variant.id}`) || null,
          });
        }
      } else {
        rows.push({
          productId: product.id,
          productName: product.name,
          variantId: null,
          variantName: null,
          sku: product.sku,
          unit: product.unit,
          category: product.category?.name || "",
          brand: product.brand?.name || "",
          profile: profileByKey.get(`${product.id}:BASE`) || null,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      total: rows.length,
      configured: rows.filter((row) => row.profile?.active).length,
      rows,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("[AGENT_LOGISTICS_GET]", error);
    return NextResponse.json({ error: error?.message || "No se pudieron cargar perfiles logísticos" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = String(body?.productId || "").trim();
    const variantId = body?.variantId ? String(body.variantId).trim() : null;
    const weightKg = Number(body?.weightKg);
    const lengthCm = Number(body?.lengthCm);
    const widthCm = Number(body?.widthCm);
    const heightCm = Number(body?.heightCm);
    const unitsPerPackage = Math.max(1, Math.round(Number(body?.unitsPerPackage || 1)));
    const maxUnitsPerPackageRaw = Number(body?.maxUnitsPerPackage || 0);
    const maxUnitsPerPackage = maxUnitsPerPackageRaw > 0 ? Math.round(maxUnitsPerPackageRaw) : null;

    if (!productId) return NextResponse.json({ error: "Falta productId" }, { status: 400 });
    if (![weightKg, lengthCm, widthCm, heightCm].every((value) => Number.isFinite(value) && value > 0)) {
      return NextResponse.json({ error: "Peso y dimensiones deben ser mayores a 0" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    if (variantId) {
      const variant = await prisma.variant.findFirst({ where: { id: variantId, productId }, select: { id: true } });
      if (!variant) return NextResponse.json({ error: "La variante no pertenece al producto" }, { status: 400 });
    }

    const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      variantId
        ? `SELECT "id" FROM "ShippingProfile" WHERE "variantId"=$1 LIMIT 1`
        : `SELECT "id" FROM "ShippingProfile" WHERE "productId"=$1 AND "variantId" IS NULL LIMIT 1`,
      variantId || productId,
    );

    const id = existing[0]?.id || randomUUID();
    if (existing.length) {
      await prisma.$executeRawUnsafe(
        `UPDATE "ShippingProfile" SET "weightKg"=$2, "lengthCm"=$3, "widthCm"=$4, "heightCm"=$5,
         "unitsPerPackage"=$6, "maxUnitsPerPackage"=$7, "active"=true, "updatedAt"=NOW() WHERE "id"=$1`,
        id, weightKg, lengthCm, widthCm, heightCm, unitsPerPackage, maxUnitsPerPackage,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ShippingProfile" ("id","productId","variantId","weightKg","lengthCm","widthCm","heightCm","unitsPerPackage","maxUnitsPerPackage","active","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW(),NOW())`,
        id, productId, variantId, weightKg, lengthCm, widthCm, heightCm, unitsPerPackage, maxUnitsPerPackage,
      );
    }

    return NextResponse.json({ ok: true, id });
  } catch (error: any) {
    console.error("[AGENT_LOGISTICS_PUT]", error);
    return NextResponse.json({ error: error?.message || "No se pudo guardar el perfil logístico" }, { status: 500 });
  }
}
