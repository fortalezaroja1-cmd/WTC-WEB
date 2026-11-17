"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Menu, MessageCircle, Search, ShieldCheck, ShoppingCart, X } from "lucide-react";
import { useCart } from "./CartProvider";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  subcategories: { id: string; name: string; slug: string }[];
}

export function StoreHeader({ categories, tagline }: { categories: Category[]; storeName: string; tagline: string }) {
  const router = useRouter();
  const { items, setOpen } = useCart();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const whatsappUrl = `https://wa.me/573143506623?text=${encodeURIComponent("Hola Wired Technology, necesito cotizar una referencia.")}`;

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) router.push(`/productos?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <>
      <div className="bg-copper px-4 py-2 text-center text-[11px] font-semibold text-white sm:text-xs">
        Precios visibles en COP · Confirma disponibilidad y entrega antes de pagar
      </div>
      <header className="sticky top-0 z-40 bg-graphite shadow-lg">
        <div className="mx-auto flex h-[66px] max-w-[1180px] items-center gap-3 px-4 sm:gap-4 sm:px-5">
          <button onClick={() => setMenuOpen(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white md:hidden" aria-label="Abrir menú"><Menu size={22} /></button>
          <Link href="/" className="shrink-0 min-w-0"><div className="whitespace-nowrap font-display text-[14px] font-bold tracking-tight text-white min-[380px]:text-base sm:text-lg">WIRED<span className="text-copper">·</span>TECHNOLOGY</div><div className="hidden font-mono text-[9.5px] uppercase tracking-[.14em] text-muted sm:block">{tagline}</div></Link>

          <nav className="ml-3 hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
            <Link href="/productos" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white">Productos</Link>
            {categories.slice(0, 3).map((category) => <Link key={category.id} href={`/categorias/${category.slug}`} className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white">{category.name}</Link>)}
          </nav>

          <form onSubmit={handleSearch} className="relative ml-auto hidden max-w-[360px] flex-1 sm:block"><Search size={17} className="absolute left-3 top-[11px] text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Calibre, producto o SKU…" className="w-full rounded-lg border border-slate-dark bg-graphite-2 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-muted focus:border-copper focus:outline-none" /></form>

          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="hidden min-h-11 items-center gap-2 rounded-lg border border-slate-dark px-3 py-2 text-xs font-semibold text-white hover:border-copper lg:flex"><MessageCircle size={16} /> Cotizar</a>
            <button onClick={() => setOpen(true)} className="relative flex min-h-11 items-center gap-2 rounded-lg bg-copper px-3 py-2 text-white transition-colors hover:bg-copper-bright" aria-label={`Abrir mi pedido, ${count} productos`}><ShoppingCart size={20} /><span className="hidden text-sm font-semibold min-[390px]:inline">Pedido</span>{count > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-amber px-1 text-[11px] font-bold text-graphite">{count}</span>}</button>
          </div>
        </div>

        <form onSubmit={handleSearch} role="search" className="px-4 pb-3 sm:hidden"><label htmlFor="mobile-product-search" className="sr-only">Buscar productos por nombre o referencia</label><div className="flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-white bg-white px-3 focus-within:border-copper"><Search size={20} className="shrink-0 text-graphite" /><input id="mobile-product-search" value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="¿Qué producto necesitas?" className="h-12 w-full min-w-0 text-base text-ink outline-none placeholder:text-muted" /></div><button type="submit" className="min-h-12 rounded-xl bg-copper px-4 font-semibold text-white">Buscar</button></div></form>
      </header>

      {menuOpen && <div className="fixed inset-0 z-50 flex bg-black/50" onClick={() => setMenuOpen(false)}><div className="h-full w-[340px] max-w-[90vw] overflow-y-auto bg-white" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-hair p-4"><span className="font-display font-bold">Comprar</span><button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={20} /></button></div><div className="px-4 pb-3 pt-5"><p className="text-lg font-bold">¿Qué necesitas?</p><p className="mt-1 text-sm text-muted">Busca por referencia o entra por categoría.</p></div><Link href="/productos" onClick={() => setMenuOpen(false)} className="flex min-h-14 items-center justify-between border-b border-hair px-4 py-3.5 font-bold text-copper">Ver todos los productos <ChevronRight size={18} /></Link>{categories.map((category) => <Link key={category.id} href={`/categorias/${category.slug}`} onClick={() => setMenuOpen(false)} className="flex min-h-14 items-center justify-between border-b border-hair px-4 py-3.5 transition-colors hover:bg-paper"><span className="text-sm font-semibold">{category.name}</span><ChevronRight size={16} className="text-muted" /></Link>)}<a href={whatsappUrl} target="_blank" rel="noreferrer" className="mx-4 mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-green px-4 font-bold text-white"><MessageCircle size={18} /> Cotizar por WhatsApp</a><Link href="/admin/login" onClick={() => setMenuOpen(false)} className="mt-4 flex items-center gap-2 px-4 py-5 text-xs text-muted underline"><ShieldCheck size={14} /> Acceso administrativo</Link></div></div>}
    </>
  );
}
