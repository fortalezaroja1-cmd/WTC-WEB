"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import WiredAssistant from "@/components/WiredAssistant";
import AdminGlobalSearch from "@/components/AdminGlobalSearch";
import { LayoutDashboard, Boxes, ClipboardList, Package, Users, Settings, Store, LogOut, BellRing, Bot, Menu, X, ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/admin/inbox", label: "Bandeja", icon: BellRing, permission: "inbox.view" },
  { href: "/admin/crm", label: "CRM", icon: LayoutDashboard, permission: "crm.view" },
  { href: "/admin/cotizaciones", label: "Cotizaciones", icon: ClipboardList, permission: "crm.view" },
  { href: "/admin/agente", label: "Probar agente", icon: Bot, permission: "agent.use" },
  { href: "/admin/tareas", label: "Tareas", icon: ClipboardList, permission: "tasks.view" },
  { href: "/admin/automatizaciones", label: "Automatizaciones", icon: Settings, permission: "automations.view" },
  { href: "/admin/productos", label: "Productos", icon: Boxes, permission: "products.view" },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, permission: "orders.view" },
  { href: "/admin/inventario", label: "Inventario", icon: Package, permission: "inventory.view" },
  { href: "/admin/clientes", label: "Clientes", icon: Users, permission: "customers.view" },
  { href: "/admin/devoluciones", label: "Devoluciones", icon: Package, permission: "returns.view" },
  { href: "/admin/analitica", label: "Analítica", icon: LayoutDashboard, permission: "analytics.view" },
  { href: "/admin/integraciones", label: "Integraciones", icon: Settings, permission: "integrations.view" },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings, permission: "settings.view" },
  { href: "/admin/usuarios", label: "Usuarios y permisos", icon: ShieldCheck, permission: "users.manage" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState({ newOrders: 0, unreadConversations: 0, newOpportunities: 0, notifications: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [session, setSession] = useState<{ role: string; name: string; permissions: string[] } | null>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setSession(data))
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    const syncInboxMode = () => {
      const mobile = window.innerWidth < 768;
      if (mobile && pathname === "/admin/inbox") router.replace("/admin/inbox/mobile");
      if (!mobile && pathname === "/admin/inbox/mobile") router.replace("/admin/inbox");
    };
    syncInboxMode();
    window.addEventListener("resize", syncInboxMode);
    return () => window.removeEventListener("resize", syncInboxMode);
  }, [pathname, router]);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    let active = true;
    const refresh = async () => {
      try {
        const res = await fetch("/api/admin/nav-counts", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setCounts({
          newOrders: Number(data.newOrders || 0),
          unreadConversations: Number(data.unreadConversations || 0),
          newOpportunities: Number(data.newOpportunities || 0),
          notifications: Number(data.notifications || 0),
        });
      } catch {}
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [pathname, session]);

  if (pathname === "/admin/login") return <>{children}</>;

  const can = (permission: string) => !session || session.role === "ADMIN" || session.permissions?.includes(permission);

  const logout = async () => {
    document.cookie = "wt_admin_token=; path=/; max-age=0";
    router.push("/admin/login");
  };

  const Navigation = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div className="p-5 pb-4 border-b border-slate-dark flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display font-bold text-white text-[15px]">WIRED<span className="text-copper">·</span>TECH</div>
          <div className="font-mono text-[9px] tracking-[.12em] text-muted mt-0.5">PANEL ADMINISTRATIVO</div>
          {session?.name && <div className="text-[10px] text-[#929BA6] mt-2 truncate">{session.name}</div>}
        </div>
        {mobile && (
          <button type="button" onClick={() => setMobileMenuOpen(false)} className="w-9 h-9 rounded-lg border border-slate-dark flex items-center justify-center text-white" aria-label="Cerrar menú">
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="flex-1 p-2.5 overflow-y-auto overscroll-contain">
        {NAV.filter((item) => can(item.permission)).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          const badge = href === "/admin/pedidos" ? counts.newOrders : href === "/admin/crm" ? counts.newOpportunities : href === "/admin/inbox" ? counts.unreadConversations : 0;
          return (
            <Link key={href} href={href} className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium mb-0.5 transition-colors ${active ? "bg-slate-dark text-white" : "hover:bg-slate-dark/50"}`}>
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {badge > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-copper text-white text-[10px] font-bold flex items-center justify-center">{badge}</span>}
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
        <button type="button" onClick={() => setMobileMenuOpen(true)} className="w-9 h-9 rounded-lg border border-slate-dark flex items-center justify-center" aria-label="Abrir menú">
          <Menu size={19} />
        </button>
        <div className="font-display font-bold text-[14px]">WIRED<span className="text-copper">·</span>TECH</div>
        <div className="w-9 flex justify-end">
          {counts.unreadConversations > 0 && can("inbox.view") && (
            <Link href="/admin/inbox" className="min-w-6 h-6 px-1.5 rounded-full bg-copper text-white text-[10px] font-bold flex items-center justify-center">{counts.unreadConversations}</Link>
          )}
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/55" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú" />
          <aside className="relative w-[82vw] max-w-[310px] h-full bg-graphite text-[#C4CCD6] flex flex-col shadow-2xl">
            <Navigation mobile />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 w-full">
        {counts.newOrders > 0 && can("orders.view") && !["/admin/pedidos", "/admin/crm"].includes(pathname) && !pathname.startsWith("/admin/inbox") && (
          <Link href="/admin/inbox" className="mx-3 sm:mx-5 md:mx-7 mt-3 sm:mt-5 flex items-center gap-2 rounded-lg border border-copper/30 bg-amber-50 px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-slate-dark hover:border-copper transition-colors">
            <BellRing size={16} className="text-copper shrink-0" />
            <span>{counts.newOrders} pedido{counts.newOrders === 1 ? " nuevo" : "s nuevos"} sin revisar</span>
          </Link>
        )}
        <div className="p-3 sm:p-5 md:p-7 min-w-0"><AdminGlobalSearch />{children}</div>
      </main>
      <WiredAssistant audience="team" />
    </div>
  );
}
