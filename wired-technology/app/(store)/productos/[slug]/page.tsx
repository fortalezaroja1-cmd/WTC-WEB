import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, CheckCircle2, HelpCircle, MessageCircle, PackageCheck, Search } from "lucide-react";
import { AddToCart } from "@/components/store/AddToCart";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductViewTracker } from "@/components/store/ProductViewTracker";

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      brand: true,
      category: true,
      subcategory: true,
      variants: { where: { active: true }, orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" } },
      specs: { orderBy: { order: "asc" } },
    },
  });

  if (!product || product.status !== "PUBLISHED") notFound();

  const [settings, relatedProducts] = await Promise.all([
    prisma.siteSetting.findMany(),
    prisma.product.findMany({
      where: { status: "PUBLISHED", categoryId: product.categoryId, id: { not: product.id } },
      include: { brand: true, variants: { where: { active: true } }, images: { orderBy: { order: "asc" }, take: 1 } },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      take: 3,
    }),
  ]);

  const cfg: Record<string, string> = {};
  settings.forEach((setting) => (cfg[setting.key] = setting.value));
  const whatsapp = cfg.whatsapp || "573143506623";
  const mainImage = product.images[0]?.url || null;
  const viewPrice = product.variants.length > 0 ? Math.min(...product.variants.map((variant) => Number(variant.price))) : Number(product.price) || 0;
  const quoteUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola Wired Technology, quiero cotizar por volumen: ${product.name} (${product.sku}).`)}`;

  return (
    <>
      <ProductViewTracker sku={product.sku} name={product.name} value={viewPrice} />
      <div className="mx-auto max-w-[1240px] px-5 py-7">
        <Link href={`/categorias/${product.category.slug}`} className="mb-4 inline-flex items-center gap-1 font-mono text-xs font-semibold text-copper hover:underline"><ArrowLeft size={13} /> Volver a {product.category.name}</Link>

        <div className="grid grid-cols-1 items-start gap-9 md:grid-cols-[1.08fr_.92fr] lg:gap-14">
          <div>
            <ProductGallery productName={product.name} images={product.images.map((image) => ({ url: image.url, alt: image.alt }))} />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { icon: BadgeCheck, title: "Referencia visible", text: product.sku },
                { icon: PackageCheck, title: "Presentación", text: product.unit },
                { icon: MessageCircle, title: "Confirmación", text: "Antes de pagar" },
              ].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-xl border border-hair bg-white p-4"><Icon size={20} className="text-copper" /><p className="mt-2 text-xs font-bold">{title}</p><p className="mt-1 text-xs text-muted">{text}</p></div>)}
            </div>
          </div>

          <div className="md:sticky md:top-24">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#F0EDE8] px-2 py-0.5 font-mono text-[11px] font-medium text-slate-dark">{product.brand.name}</span><span className="rounded-md border border-hair bg-white px-2 py-0.5 font-mono text-[11px] text-muted">SKU {product.sku}</span></div>
            <h1 className="mb-3 mt-3 font-display text-[30px] font-bold leading-tight md:text-[38px]">{product.name}</h1>
            <p className="mb-5 text-[15px] leading-relaxed text-slate-dark">{product.description || `Referencia de ${product.category.name} disponible para agregar al pedido. Revisa la presentación, el precio y la disponibilidad antes de confirmar.`}</p>

            <div className="mb-5 rounded-2xl border border-copper/25 bg-[#FBF3EC] p-4">
              <div className="flex gap-3"><HelpCircle size={21} className="mt-0.5 shrink-0 text-copper" /><div><p className="font-bold">Evita comprar la referencia equivocada</p><p className="mt-1 text-sm leading-relaxed text-slate-dark">Confirma calibre, presentación y cantidad. Si no estás seguro, solicita asesoría antes de agregar.</p></div></div>
            </div>

            <AddToCart productId={product.id} productName={product.name} productSku={product.sku} productSlug={product.slug} productUnit={product.unit} productImage={mainImage} price={product.variants.length === 0 ? Number(product.price) || 0 : undefined} stock={product.variants.length === 0 ? product.stock : undefined} variants={product.variants.length > 0 ? product.variants.map((variant) => ({ id: variant.id, name: variant.name, sku: variant.sku, price: Number(variant.price), stock: variant.stock, image: variant.image })) : undefined} whatsapp={whatsapp} />

            <a href={quoteUrl} target="_blank" rel="noreferrer" className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-green bg-white px-4 text-sm font-bold text-green hover:bg-green-50"><MessageCircle size={18} /> Cotizar cantidad o compra por volumen</a>

            <div className="mt-6 grid gap-2 rounded-2xl border border-hair bg-white p-4 text-sm">
              {["Precio del producto visible antes de agregar", "Inventario y entrega confirmados por un asesor", "El pedido puede incluir varias referencias"].map((text) => <div key={text} className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-green" /><span>{text}</span></div>)}
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-2xl border border-hair bg-white p-6 sm:p-8">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-copper">Comprueba que sea la referencia correcta</div>
            <h2 className="mt-2 font-display text-2xl font-bold">Información para decidir</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">Usa la ficha técnica para validar la compatibilidad con tu proyecto. La categoría, marca, SKU y presentación deben coincidir con lo que necesitas.</p>
            {product.specs.length > 0 ? (
              <table className="mt-6 w-full overflow-hidden rounded-lg border border-hair text-sm"><tbody>{product.specs.map((spec) => <tr key={spec.id} className="border-b border-hair last:border-0"><td className="w-[150px] px-3 py-3 font-mono text-xs text-muted">{spec.key}</td><td className="px-3 py-3 font-medium">{spec.value}</td></tr>)}</tbody></table>
            ) : <div className="mt-6 rounded-xl bg-paper p-4 text-sm text-muted">Esta referencia todavía no tiene especificaciones adicionales publicadas. Confírmalas con un asesor antes de cerrar el pedido.</div>}
          </section>

          <section className="rounded-2xl bg-graphite p-6 text-white sm:p-8">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-copper-bright">Cómo comprar</div>
            <h2 className="mt-2 font-display text-2xl font-bold">Del producto a la confirmación</h2>
            <ol className="mt-6 space-y-5">
              {[
                ["1", "Elige la variante", "Selecciona presentación y cantidad disponibles."],
                ["2", "Agrega al pedido", "Puedes seguir comprando o pasar al checkout."],
                ["3", "Confirma por WhatsApp", "Un asesor valida inventario, entrega y costo final antes de pagar."],
              ].map(([number, title, text]) => <li key={number} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-copper font-bold">{number}</span><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-white/65">{text}</p></div></li>)}
            </ol>
            <Link href="/productos" className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 font-bold hover:border-copper"><Search size={18} /> Buscar otra referencia</Link>
          </section>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mx-auto max-w-[1240px] px-5 pb-10 pt-8">
          <div className="flex items-end justify-between gap-4"><div><div className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-copper">Sigue comparando</div><h2 className="mt-2 font-display text-3xl font-bold">Otras referencias de {product.category.name}</h2></div><Link href={`/categorias/${product.category.slug}`} className="hidden text-sm font-bold text-copper hover:underline sm:block">Ver toda la categoría</Link></div>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {relatedProducts.map((related) => {
              const hasVariants = related.variants.length > 0;
              const minPrice = hasVariants ? Math.min(...related.variants.map((variant) => Number(variant.price))) : Number(related.price) || 0;
              const totalStock = hasVariants ? related.variants.reduce((sum, variant) => sum + variant.stock, 0) : related.stock;
              return <ProductCard key={related.id} slug={related.slug} name={related.name} sku={related.sku} brand={related.brand.name} image={related.images[0]?.url || null} price={minPrice} hasVariants={hasVariants} unit={related.unit} totalStock={totalStock} />;
            })}
          </div>
        </section>
      )}
    </>
  );
}
