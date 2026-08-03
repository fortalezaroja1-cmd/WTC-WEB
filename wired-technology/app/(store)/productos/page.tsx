import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/store/ProductCard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "";

  const products = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { brand: { name: { contains: q, mode: "insensitive" } } },
          { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
        ],
      } : {}),
    },
    include: { brand: true, variants: true, images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { featured: "desc" },
  });

  return (
    <div className="max-w-[1180px] mx-auto px-5 py-7">
      <Link href="/" className="font-mono text-xs text-copper font-semibold inline-flex items-center gap-1 mb-3 hover:underline">
        <ArrowLeft size={13} /> INICIO
      </Link>
      <h1 className="font-display text-2xl font-bold mb-1">
        {q ? `Resultados para "${q}"` : "Todos los productos"}
      </h1>
      <p className="font-mono text-xs text-muted mb-5">{products.length} productos</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted">No se encontraron productos.</div>
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
