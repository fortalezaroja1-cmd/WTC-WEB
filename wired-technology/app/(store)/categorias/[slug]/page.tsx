import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductCard } from "@/components/store/ProductCard";

export default async function CategoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: { subcategories: { where: { active: true }, orderBy: { order: "asc" } } },
  });
  if (!category) notFound();

  const products = await prisma.product.findMany({
    where: { categoryId: category.id, status: "PUBLISHED" },
    include: { brand: true, variants: true, images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
  });

  return (
    <div className="max-w-[1180px] mx-auto px-5 py-7">
      <Link href="/" className="font-mono text-xs text-copper font-semibold inline-flex items-center gap-1 mb-3 hover:underline">
        <ArrowLeft size={13} /> INICIO
      </Link>
      <h1 className="font-display text-2xl font-bold mb-1">{category.name}</h1>
      <p className="font-mono text-xs text-muted mb-5">{products.length} productos</p>

      {/* Subcategorías como chips */}
      {category.subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {category.subcategories.map((sub) => (
            <span key={sub.id} className="font-mono text-xs bg-card border border-hair px-3 py-1.5 rounded-lg">
              {sub.name}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted">No hay productos en esta categoría.</div>
        )}
        {products.map((p) => {
          const hasVars = p.variants.length > 0;
          const minPrice = hasVars ? Math.min(...p.variants.map((v) => Number(v.price))) : Number(p.price) || 0;
          const totalStock = hasVars ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
          return (
            <ProductCard key={p.id} slug={p.slug} name={p.name} sku={p.sku} brand={p.brand.name}
              image={p.images[0]?.url || null} price={minPrice} hasVariants={hasVars}
              unit={p.unit} totalStock={totalStock} />
          );
        })}
      </div>
    </div>
  );
}
