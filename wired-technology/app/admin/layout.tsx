"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Boxes, ClipboardList, Package, Users, Settings, Store, LogOut, BellRing, Bot, Menu, X } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/inbox", label: "Bandeja", icon: BellRing },
  { href: "/admin/crm", label: "CRM", icon: LayoutDashboard },
  { href: "/admin/agente", label: "Probar agente", icon: Bot },
  { href: "/admin/tareas", label: "Tareas", icon: ClipboardList },
  { href: "/admin/automatizaciones", label: "Automatizaciones", icon: Settings },
  { href: "/admin/productos", label: "Productos", icon: Boxes },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/inventario", label: "Inventario", icon: Package },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/devoluciones", label: "Devoluciones", icon: Package },
  { href: "/admin/analitica", label: "Analítica", icon: LayoutDashboard },
  { href: "/admin/integraciones", label: "Integraciones", icon: Settings },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [newOrders, setNewOrders] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    let active = true;
    const refresh = async () => {
      try {
        const res = await fetch("/api/admin/orders", { cache: "no-store" });
        if (!res.ok) return;
        const orders = await res.json();
        if (active) setNewOrders(orders.filter((o: any) => o.shipStatus === "PENDING_PAYMENT").length);
      } catch {}
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [pathname]);

  if (pathname === "/admin/login") return <>{children}</>;

  const logout = async () => {
    document.cookie = "wt_admin_token=; path=/; max-age=0";
    router.push("/admin/login");
  };

  const Navigation = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div className="p-5 pb-4 border-b border-slate-dark flex items-center justify-between gap-3">
        <div>
          <div className="font-display font-bold text-white text-[15px]">WIRED<span className="text-copper">·</span>TECH</div>
          <div className="font-mono text-[9px] tracking-[.12em] text-muted mt-0.5">PANEL ADMINISTRATIVO</div>
        </div>
        {mobile && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="w-9 h-9 rounded-lg border border-slate-dark flex items-center justify-center text-white"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="flex-1 p-2.5 overflow-y-auto overscroll-contain">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          const showBadge = href === "/admin/pedidos" || href === "/admin/crm" || href === "/admin/inbox";
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium mb-0.5 transition-colors ${active ? "bg-slate-dark text-white" : "hover:bg-slate-dark/50"}`}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {showBadge && newOrders > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-copper text-white text-[10px] font-bold flex items-center justify-center">{newOrders}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="p-2.5 border-t border-slate-dark">
        <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] hover:bg-slate-dark/50 transition-colors"><Store size={17} /> Ver tienda</Link>
        <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13.5px] hover:bg-slate-dark/50 transition-colors text-left"><LogOut size={17} /> Cerrar sesión</button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-paper md:flex overflow-x-hidden">
      <aside className="hidden md:flex w-[232px] bg-graphite text-[#C4CCD6] flex-col sticky top-0 h-screen shrink-0">
        <Navigation />
      </aside>

      <header className="md:hidden sticky top-0 z-40 h-14 bg-graphite text-white border-b border-slate-dark flex items-center justify-between px-4 shadow-sm">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="w-9 h-9 rounded-lg border border-slate-dark flex items-center justify-center"
          aria-label="Abrir menú"
        >
          <Menu size={19} />
        </button>
        <div className="font-display font-bold text-[14px]">WIRED<span className="text-copper">·</span>TECH</div>
        <div className="w-9 flex justify-end">
          {newOrders > 0 && (
            <Link href="/admin/inbox" className="min-w-6 h-6 px-1.5 rounded-full bg-copper text-white text-[10px] font-bold flex items-center justify-center">
              {newOrders}
            </Link>
          )}
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          />
          <aside className="relative w-[82vw] max-w-[310px] h-full bg-graphite text-[#C4CCD6] flex flex-col shadow-2xl">
            <Navigation mobile />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 w-full">
        {newOrders > 0 && !["/admin/pedidos", "/admin/crm", "/admin/inbox"].includes(pathname) && (
          <Link href="/admin/inbox" className="mx-3 sm:mx-5 md:mx-7 mt-3 sm:mt-5 flex items-center gap-2 rounded-lg border border-copper/30 bg-amber-50 px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-slate-dark hover:border-copper transition-colors">
            <BellRing size={16} className="text-copper shrink-0" />
            <span>{newOrders} pedido{newOrders === 1 ? " nuevo" : "s nuevos"} sin revisar</span>
          </Link>
        )}
        <div className="p-3 sm:p-5 md:p-7 min-w-0">{children}</div>
      </main>
    </div>
  );
}
