import { applyStoreBalances } from "@/lib/trefi-stock";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { CartProvider, type CartRecommendation } from "@/components/store/CartProvider";
import { StoreHeader } from "@/components/store/Header";
import { MessageCircle } from "lucide-react";
import WiredAssistant from "@/components/WiredAssistant";
import { MetaPixelConsent, CookiePreferencesButton } from "@/components/store/MetaPixelConsent";
import { PromotionPopup, type EntryPromotion } from "@/components/store/PromotionPopup";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings, recommendationProducts] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: { subcategories: { where: { active: true }, orderBy: { order: "asc" } } },
    }),
    prisma.siteSetting.findMany(),
    prisma.product.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        sku: true,
        slug: true,
        price: true,
        promoPrice: true,
        stock: true,
        featured: true,
        images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
        variants: {
          where: { active: true },
          orderBy: { order: "asc" },
          select: { id: true, name: true, sku: true, price: true, promoPrice: true, stock: true, image: true },
        },
      },
    }),
  ]);
  const inventoryStatus = await applyStoreBalances(recommendationProducts);

  const cfg: Record<string, string> = {};
  settings.forEach((s) => (cfg[s.key] = s.value));

  const recommendations: CartRecommendation[] = recommendationProducts.map(product => {
    const hasVariants = product.variants.length > 0;
    // El precio publicado ya tiene el 30 % aplicado. Todas las superficies de
    // compra deben usar el mismo valor para evitar discrepancias en el carrito.
    const prices = hasVariants
      ? product.variants.map(variant => Number(variant.price))
      : [Number(product.price ?? 0)];
    const stock = hasVariants
      ? product.variants.reduce((total, variant) => total + Math.max(0, variant.stock), 0)
      : Math.max(0, product.stock);

    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      price: Math.min(...prices),
      image: product.images[0]?.url ?? null,
      hasVariants,
      stock,
      featured: product.featured,
      variants: product.variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        price: Number(variant.price),
        stock: Math.max(0, variant.stock),
        image: variant.image,
      })),
    };
  });

  const whatsapp = cfg.whatsapp || "573143506623";
  const waUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola Wired Technology, tengo una consulta")}`;

  const now = Date.now();
  const startsAt = cfg.promotionStartsAt ? Date.parse(cfg.promotionStartsAt) : Number.NaN;
  const endsAt = cfg.promotionEndsAt ? Date.parse(cfg.promotionEndsAt) : Number.NaN;
  const promotionIsCurrent =
    cfg.promotionEnabled === "true" &&
    (!Number.isFinite(startsAt) || startsAt <= now) &&
    (!Number.isFinite(endsAt) || endsAt >= now);
  const promotionProduct = promotionIsCurrent
    ? recommendationProducts.find(product => product.id === cfg.promotionProductId)
    : undefined;
  let entryPromotion: EntryPromotion | null = null;
  if (promotionProduct) {
    const hasVariants = promotionProduct.variants.length > 0;
    const selectedVariant = hasVariants
      ? promotionProduct.variants.reduce((best, variant) =>
          Number(variant.promoPrice ?? variant.price) < Number(best.promoPrice ?? best.price) ? variant : best
        )
      : null;
    const price = selectedVariant
      ? Number(selectedVariant.promoPrice ?? selectedVariant.price)
      : Number(promotionProduct.promoPrice ?? promotionProduct.price ?? 0);
    const originalPrice = selectedVariant
      ? Number(selectedVariant.price)
      : Number(promotionProduct.price ?? 0);
    const stock = hasVariants
      ? promotionProduct.variants.reduce((total, variant) => total + Math.max(0, variant.stock), 0)
      : Math.max(0, promotionProduct.stock);
    if (price > 0 && stock > 0) {
      entryPromotion = {
        id: promotionProduct.id,
        name: promotionProduct.name,
        sku: promotionProduct.sku,
        slug: promotionProduct.slug,
        description: promotionProduct.description,
        price,
        originalPrice: originalPrice > price ? originalPrice : null,
        image: promotionProduct.images[0]?.url ?? null,
        hasVariants,
      };
    }
  }

  return (
    <CartProvider whatsapp={whatsapp} recommendations={recommendations}>
      <MetaPixelConsent />
      {inventoryStatus !== "ready" && <p role="status" className="px-4 py-2 text-center text-sm">
        {inventoryStatus === "offline" ? "Estamos verificando existencias con la bodega. Los pedidos se confirman cuando se restablezca la consulta." : "Las referencias pendientes de conteo se habilitarán cuando bodega confirme sus existencias."}
      </p>}
      {entryPromotion && (
        <PromotionPopup
          promotion={entryPromotion}
          title={cfg.promotionTitle || "Promoción destacada"}
          message={cfg.promotionMessage || "Conoce este producto seleccionado y agrégalo a tu pedido."}
        />
      )}
      <div className="min-h-screen flex flex-col">
        <StoreHeader categories={categories} storeName={cfg.storeName || "Wired Technology"} tagline={cfg.tagline || ""} whatsapp={whatsapp} />

        <main className="flex-1">{children}</main>

        <footer className="bg-graphite text-muted mt-16">
          <div className="max-w-[1180px] mx-auto px-5 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="font-display font-bold text-white text-lg">WIRED·TECHNOLOGY</div>
              <p className="text-sm mt-2 max-w-[280px]">{cfg.tagline}. {cfg.city}.</p>
            </div>
            <div>
              <div className="font-mono text-xs tracking-widest uppercase text-muted mb-3">Categorías</div>
              {categories.map((c) => (
                <Link key={c.id} href={`/categorias/${c.slug}`} className="block text-sm mb-2 hover:text-copper transition-colors">
                  {c.name}
                </Link>
              ))}
            </div>
            <div>
              <div className="font-mono text-xs tracking-widest uppercase text-muted mb-3">Contacto</div>
              <a href={waUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 bg-green text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
                <MessageCircle size={16} /> WhatsApp de ventas
              </a>
            </div>
          </div>
          <div className="border-t border-slate-dark text-center py-4 font-mono text-xs">
            © {new Date().getFullYear()} WIRED TECHNOLOGY <span className="mx-2">·</span> <CookiePreferencesButton />
          </div>
        </footer>

        <WiredAssistant audience="customer" />
      </div>
    </CartProvider>
  );
}
