import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/store/ProductCard";
import { cableCatalogHref } from "@/lib/storefront-navigation";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CircleDollarSign,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
} from "lucide-react";

export const revalidate = 60;

export default async function HomePage() {
  const [categories, featuredProducts, publishedCount] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: { subcategories: { where: { active: true }, orderBy: { order: "asc" } } },
    }),
    prisma.product.findMany({
      where: { featured: true, status: "PUBLISHED" },
      include: {
        brand: true,
        variants: { where: { active: true } },
        images: { orderBy: { order: "asc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
  ]);

  const cableHref = cableCatalogHref(categories);
  const heroProduct = featuredProducts.find((product) => product.images[0]?.url);
  const whatsappUrl = `https://wa.me/573143506623?text=${encodeURIComponent(
    "Hola Wired Technology, necesito ayuda para elegir una referencia y cotizar mi pedido.",
  )}`;

  return (
    <>
      <section className="relative overflow-hidden bg-graphite text-white">
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_75%_25%,#C67B42_0,transparent_34%)]" />
        <div className="relative z-10 mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-10 sm:py-16 lg:grid-cols-[1.08fr_.92fr] lg:py-20">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-copper-bright">
              <BadgeCheck size={15} /> Distribuidor de Centelsa y Mercury
            </div>
            <h1 className="max-w-[720px] font-display text-[34px] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[58px]">
              Compra el material eléctrico correcto <span className="text-copper-bright">sin perder tiempo buscando referencias.</span>
            </h1>
            <p className="mt-5 max-w-[610px] text-base leading-relaxed text-white/78 sm:text-lg">
              Busca por calibre, nombre o SKU, compara precios publicados y arma tu pedido. Antes de pagar, un asesor confirma disponibilidad, entrega y costo final contigo.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/productos" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-copper px-6 py-3 text-base font-bold text-white transition-colors hover:bg-copper-bright">
                Encontrar mi referencia <Search size={19} />
              </Link>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-white/25 px-6 py-3 text-base font-semibold text-white transition-colors hover:border-copper hover:text-copper-bright">
                Pedir asesoría <MessageCircle size={19} />
              </a>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/72">
              <span className="inline-flex items-center gap-2"><CircleDollarSign size={18} className="text-copper-bright" /> Precios visibles en COP</span>
              <span className="inline-flex items-center gap-2"><PackageCheck size={18} className="text-copper-bright" /> Disponibilidad confirmada antes de pagar</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="absolute -inset-5 rounded-[36px] bg-copper/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-hair pb-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.14em] text-muted">Catálogo disponible</p>
                  <p className="mt-1 font-display text-2xl font-bold text-ink">{publishedCount} referencias</p>
                </div>
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green">Compra asistida</span>
              </div>
              <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-[#F8F5F0]">
                {heroProduct?.images[0]?.url ? (
                  <Image src={heroProduct.images[0].url} alt={heroProduct.name} fill priority className="object-contain p-3" sizes="(max-width:1024px) 90vw, 520px" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-copper"><ShoppingCart size={92} strokeWidth={0.8} /></div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted">Busca, compara y agrega</p>
                  <p className="mt-1 font-semibold text-ink">Tu pedido queda listo para confirmar</p>
                </div>
                <Link href="/productos" aria-label="Abrir catálogo" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-graphite text-white"><ArrowRight size={20} /></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-hair bg-white">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 divide-y divide-hair px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { number: "01", title: "Encuentra", text: "Busca por producto, calibre, marca o referencia." },
            { number: "02", title: "Arma el pedido", text: "Compara precios y agrega las cantidades necesarias." },
            { number: "03", title: "Confirma", text: "Enviamos el pedido a WhatsApp y validamos entrega y disponibilidad." },
          ].map((step) => (
            <div key={step.number} className="flex gap-4 py-6 sm:px-6 first:pl-0 last:pr-0">
              <span className="font-mono text-sm font-bold text-copper">{step.number}</span>
              <div><h2 className="font-display text-lg font-bold">{step.title}</h2><p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 pt-14">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-copper">Empieza por tu necesidad</div>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">Llega más rápido al producto correcto</h2>
          </div>
          <Link href="/productos" className="inline-flex items-center gap-1 text-sm font-bold text-copper hover:underline">Ver catálogo completo <ChevronRight size={17} /></Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {categories.map((category, index) => (
            <Link key={category.id} href={`/categorias/${category.slug}`} className="group relative min-h-[210px] overflow-hidden rounded-2xl border border-hair bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-copper/50 hover:shadow-xl">
              <div className="absolute right-4 top-2 font-display text-7xl font-bold text-paper">0{index + 1}</div>
              <div className="relative">
                <span className="inline-flex rounded-full bg-[#FBF3EC] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-copper">Comprar por línea</span>
                <h3 className="mt-6 font-display text-2xl font-bold">{category.name}</h3>
                <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted">{category.subcategories.slice(0, 3).map((subcategory) => subcategory.name).join(" · ") || "Explora referencias y presentaciones disponibles."}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-copper">Explorar productos <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 pt-14">
        <div className="rounded-3xl bg-graphite p-6 text-white sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-copper-bright">Compra con menos riesgo de error</div>
              <h2 className="mt-3 font-display text-3xl font-bold">Lo que ves antes de confirmar</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70">La página te ayuda a comparar. El asesor valida contigo lo que depende de ciudad, inventario y cantidad.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: CircleDollarSign, title: "Precio publicado", text: "Valor por unidad o precio desde, según variantes." },
                { icon: ShieldCheck, title: "Referencia verificable", text: "Nombre, SKU, marca, presentación y ficha técnica." },
                { icon: MessageCircle, title: "Confirmación humana", text: "Disponibilidad, entrega y costo final por WhatsApp." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5"><Icon className="text-copper-bright" size={24} /><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/65">{text}</p></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {featuredProducts.length > 0 && (
        <section className="mx-auto max-w-[1180px] px-5 pb-4 pt-14">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-copper"><Star size={16} /> Selección del catálogo</div>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">Referencias destacadas para empezar</h2>
              <p className="mt-2 text-sm text-muted">Productos marcados como destacados en el catálogo actual.</p>
            </div>
            <Link href={cableHref} className="inline-flex items-center gap-1 text-sm font-bold text-copper hover:underline">Ver cables y alambres <ChevronRight size={17} /></Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {featuredProducts.map((product) => {
              const hasVariants = product.variants.length > 0;
              const minPrice = hasVariants ? Math.min(...product.variants.map((variant) => Number(variant.price))) : Number(product.price) || 0;
              const totalStock = hasVariants ? product.variants.reduce((sum, variant) => sum + variant.stock, 0) : product.stock;
              return <ProductCard key={product.id} slug={product.slug} name={product.name} sku={product.sku} brand={product.brand.name} image={product.images[0]?.url || null} price={minPrice} hasVariants={hasVariants} unit={product.unit} totalStock={totalStock} />;
            })}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1180px] px-5 pt-14">
        <div className="grid overflow-hidden rounded-3xl bg-copper text-white lg:grid-cols-[1fr_auto]">
          <div className="p-7 sm:p-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-white/70">Compra técnica asistida</div>
            <h2 className="mt-3 max-w-[680px] font-display text-3xl font-bold">¿No estás seguro del calibre, la presentación o la referencia?</h2>
            <p className="mt-3 max-w-[650px] text-white/85">Envíanos la lista o cuéntanos qué instalación estás preparando. Te ayudamos a ubicar la referencia dentro del catálogo antes de cerrar el pedido.</p>
          </div>
          <div className="flex items-center p-7 pt-0 sm:p-10 lg:pt-10">
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-copper shadow-lg lg:w-auto">Hablar con un asesor <MessageCircle size={19} /></a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[900px] px-5 pb-6 pt-14">
        <div className="text-center"><div className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-copper">Antes de comprar</div><h2 className="mt-2 font-display text-3xl font-bold">Preguntas frecuentes</h2></div>
        <div className="mt-7 space-y-3">
          {[
            ["¿El precio que veo es el precio final?", "Es el precio publicado del producto o la variante. El costo de entrega y cualquier condición por volumen se confirma antes del pago."],
            ["¿Cómo sé si hay disponibilidad?", "Cada ficha muestra el estado registrado en el catálogo. Un asesor vuelve a confirmar inventario y presentación cuando envías el pedido."],
            ["¿Puedo comprar varias referencias en un solo pedido?", "Sí. Agrega cada producto al carrito, ajusta cantidades y envía todo junto desde el checkout."],
            ["¿Qué hago si no conozco la referencia exacta?", "Busca por calibre, marca, categoría o descripción. Si aún tienes dudas, solicita asesoría por WhatsApp antes de agregar."],
          ].map(([question, answer]) => (
            <details key={question} className="group rounded-2xl border border-hair bg-white p-5 shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">{question}<span className="text-xl text-copper transition-transform group-open:rotate-45">+</span></summary><p className="mt-3 pr-8 text-sm leading-relaxed text-muted">{answer}</p></details>
          ))}
        </div>
      </section>
    </>
  );
}
