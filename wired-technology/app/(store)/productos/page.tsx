import { prisma } from "@/lib/db";
import { ProductCatalog } from "@/components/store/ProductCatalog";

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "";

  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    include: {
      brand: true,
      category: true,
      variants: true,
      images: { orderBy: { order: "asc" }, take: 1 },
    },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
  });

  const catalogProducts = products.map((product) => {
    const hasVariants = product.variants.length > 0;
    const minPrice = hasVariants
      ? Math.min(...product.variants.map((variant) => Number(variant.price)))
      : Number(product.price) || 0;
    const totalStock = hasVariants
      ? product.variants.reduce((total, variant) => total + variant.stock, 0)
      : product.stock;

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      brand: product.brand.name,
      category: product.category.name,
      description: product.description || "",
      image: product.images[0]?.url || null,
      price: minPrice,
      hasVariants,
      unit: product.unit,
      totalStock,
    };
  });

  return <ProductCatalog products={catalogProducts} initialQuery={q} />;
}
