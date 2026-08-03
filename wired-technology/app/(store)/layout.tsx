import Link from "next/link";
import { prisma } from "@/lib/db";
import { CartProvider } from "@/components/store/CartProvider";
import { StoreHeader } from "@/components/store/Header";
import { MessageCircle } from "lucide-react";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: { subcategories: { where: { active: true }, orderBy: { order: "asc" } } },
  });

  const settings = await prisma.siteSetting.findMany();
  const cfg: Record<string, string> = {};
  settings.forEach((s) => (cfg[s.key] = s.value));

  const whatsapp = cfg.whatsapp || "573000000000";
  const waUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola Wired Technology, tengo una consulta")}`;

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <StoreHeader categories={categories} storeName={cfg.storeName || "Wired Technology"} tagline={cfg.tagline || ""} />

        <main className="flex-1">{children}</main>

        {/* Footer */}
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
            © {new Date().getFullYear()} WIRED TECHNOLOGY
          </div>
        </footer>

        {/* WhatsApp flotante */}
        <a href={waUrl} target="_blank" rel="noreferrer"
          className="fixed bottom-6 right-6 bg-green text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-30 hover:scale-105 transition-transform">
          <MessageCircle size={26} />
        </a>
      </div>
    </CartProvider>
  );
}
