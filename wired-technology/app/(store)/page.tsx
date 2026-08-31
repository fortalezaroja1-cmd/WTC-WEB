import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/store/ProductCard";
import { formatCOP } from "@/lib/utils";
import { Truck, ShieldCheck, MessageCircle, ChevronRight, Star } from "lucide-react";

export const revalidate = 60; // ISR: reconstruir cada 60s

export default async function HomePage() {
  const [categories, featuredProducts, settings] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { order: "asc" }, include: { subcategories: true } }),
    prisma.product.findMany({
      where: { featured: true, status: "PUBLISHED" },
      include: { brand: true, variants: true, images: { orderBy: { order: "asc" }, take: 1 } },
      take: 8,
    }),
    prisma.siteSetting.findMany(),
  ]);

  const cfg: Record<string, string> = {};
  settings.forEach((s) => (cfg[s.key] = s.value));
  const freeShipFrom = Number(cfg.freeShipFrom) || 250000;

  return (
    <>
      {/* Hero */}
      <section className="bg-graphite text-white relative overflow-hidden">
        <div className="max-w-[1180px] mx-auto px-5 py-16 relative z-10">
          <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-3">
            Distribuidor Centelsa · Mercury
          </div>
          <h1 className="font-display text-4xl md:text-[46px] font-bold leading-[1.05] tracking-tight max-w-[660px]">
            El material eléctrico correcto, <span className="text-copper">calibre por calibre.</span>
          </h1>
          <p className="text-base text-muted mt-4 max-w-[520px]">
            Cables, iluminación LED y accesorios con especificaciones claras, inventario real y envío a toda Colombia.
          </p>
          <div className="flex gap-3 mt-7">
            <Link href="/categorias/cables" className="bg-copper text-white font-semibold px-5 py-3 rounded-lg inline-flex items-center gap-2 hover:bg-copper-bright transition-colors">
              Ver cables Centelsa <ChevronRight size={16} />
            </Link>
            <Link href="/categorias/iluminacion" className="border border-slate-dark text-white font-semibold px-5 py-3 rounded-lg inline-flex items-center gap-2 hover:border-copper transition-colors">
              Iluminación LED
            </Link>
          </div>
          <div className="flex gap-7 mt-9">
            {[
              [Truck, "Envío gratis", `Desde ${formatCOP(freeShipFrom)}`],
              [ShieldCheck, "Pago seguro", "Mercado Pago"],
              [MessageCircle, "Asesoría", "Por WhatsApp"],
            ].map(([Icon, title, sub]) => (
              <div key={title as string} className="flex gap-2.5 items-center">
                {/* @ts-ignore */}
                <Icon size={20} className="text-copper" />
                <div>
                  <div className="font-semibold text-sm">{title as string}</div>
                  <div className="font-mono text-[11px] text-muted">{sub as string}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="max-w-[1180px] mx-auto px-5 pt-11">
        <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold">
          Explora por línea
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {categories.map((c) => (
            <Link key={c.id} href={`/categorias/${c.slug}`}
              className="bg-card border border-hair rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="font-display font-semibold text-base">{c.name}</div>
              <div className="font-mono text-[11.5px] text-muted mt-1">
                {c.subcategories.slice(0, 3).map((s) => s.name).join(" · ")}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Destacados */}
      <section className="max-w-[1180px] mx-auto px-5 pt-8 pb-4">
        <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold flex items-center gap-1.5">
          <Star size={11} /> Más vendidos
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mt-4">
          {featuredProducts.map((p) => {
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
      </section>
    </>
  );
}
