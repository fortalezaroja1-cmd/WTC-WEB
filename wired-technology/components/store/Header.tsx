"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Menu, X, ChevronRight, ShieldCheck } from "lucide-react";
import { useCart } from "./CartProvider";

interface Category {
  id: string; name: string; slug: string; icon: string | null;
  subcategories: { id: string; name: string; slug: string }[];
}

export function StoreHeader({ categories, storeName, tagline }: {
  categories: Category[]; storeName: string; tagline: string;
}) {
  const router = useRouter();
  const { items, setOpen } = useCart();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const count = items.reduce((s, i) => s + i.qty, 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/productos?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <>
      <header className="bg-graphite sticky top-0 z-40">
        <div className="max-w-[1180px] mx-auto px-5 flex items-center gap-4 h-[66px]">
          <button onClick={() => setMenuOpen(true)} className="text-white p-1 md:hidden"><Menu size={22} /></button>

          <Link href="/" className="shrink-0">
            <div className="font-display font-bold text-white text-lg tracking-tight">
              WIRED<span className="text-copper">·</span>TECHNOLOGY
            </div>
            <div className="font-mono text-[9.5px] tracking-[.14em] uppercase text-muted hidden sm:block">{tagline}</div>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-[460px] ml-3 relative hidden sm:block">
            <Search size={17} className="absolute left-3 top-[11px] text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cable, breaker, panel LED, SKU…"
              className="w-full pl-9 pr-4 py-2.5 bg-graphite-2 border border-slate-dark rounded-lg text-white text-sm placeholder:text-muted focus:outline-none focus:border-copper" />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin/login" className="hidden md:flex items-center gap-1.5 text-muted text-xs border border-slate-dark rounded-lg px-3 py-2 hover:border-copper hover:text-copper transition-colors">
              <ShieldCheck size={14} /> Admin
            </Link>
            <button onClick={() => setOpen(true)}
              className="relative bg-copper text-white rounded-lg px-3.5 py-2.5 hover:bg-copper-bright transition-colors">
              <ShoppingCart size={18} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber text-graphite text-[11px] font-bold rounded-full min-w-[19px] h-[19px] flex items-center justify-center px-1">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="livewire" />
      </header>

      {/* Menú lateral móvil */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex" onClick={() => setMenuOpen(false)}>
          <div className="w-[300px] bg-white h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-hair">
              <span className="font-display font-bold">Categorías</span>
              <button onClick={() => setMenuOpen(false)}><X size={20} /></button>
            </div>
            {categories.map((c) => (
              <Link key={c.id} href={`/categorias/${c.slug}`} onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between p-4 border-b border-hair hover:bg-paper transition-colors">
                <span className="font-semibold text-sm">{c.name}</span>
                <ChevronRight size={16} className="text-muted" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
