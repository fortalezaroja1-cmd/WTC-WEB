import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const products = await prisma.product.findMany({
    include: { brand: true, category: true, variants: { orderBy: { order: "asc" } }, images: { orderBy: { order: "asc" } }, specs: { orderBy: { order: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { variants, specs, images, ...productData } = body;

    // La subcategoría es opcional. El formulario usa "" cuando no hay una seleccionada,
    // pero Prisma necesita null para una relación opcional.
    if (productData.subcategoryId === "") productData.subcategoryId = null;

    const product = await prisma.product.create({
      data: {
        ...productData,
        variants: variants?.length ? { create: variants.map((v: any, i: number) => ({ ...v, order: i })) } : undefined,
        specs: specs?.length ? { create: specs.map((s: any, i: number) => ({ ...s, order: i })) } : undefined,
        images: images?.length ? { create: images.map((img: any, i: number) => ({ url: img.url, alt: img.alt, order: i })) } : undefined,
      },
      include: { brand: true, category: true, variants: true, images: true, specs: true },
    });
    return NextResponse.json(product);
  } catch (err: any) {
    console.error("POST /api/admin/products error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, variants, specs, images, brand, category, subcategory, ...productData } = body;

    // La subcategoría es opcional. Un string vacío viola la FK en PostgreSQL.
    if (productData.subcategoryId === "") productData.subcategoryId = null;

    // Actualizar datos base
    await prisma.product.update({ where: { id }, data: productData });

    // Reemplazar variantes
    if (variants !== undefined) {
      await prisma.variant.deleteMany({ where: { productId: id } });
      if (variants.length) {
        await prisma.variant.createMany({ data: variants.map((v: any, i: number) => ({ ...v, productId: id, order: i })) });
      }
    }

    // Reemplazar specs
    if (specs !== undefined) {
      await prisma.productSpec.deleteMany({ where: { productId: id } });
      if (specs.length) {
        await prisma.productSpec.createMany({ data: specs.map((s: any, i: number) => ({ ...s, productId: id, order: i })) });
      }
    }

    // Reemplazar imágenes
    if (images !== undefined) {
      await prisma.productImage.deleteMany({ where: { productId: id } });
      if (images.length) {
        await prisma.productImage.createMany({ data: images.map((img: any, i: number) => ({ url: img.url, alt: img.alt || null, productId: id, order: i })) });
      }
    }

    const updated = await prisma.product.findUnique({
      where: { id },
      include: { brand: true, category: true, variants: true, images: { orderBy: { order: "asc" } }, specs: true },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PUT /api/admin/products error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
