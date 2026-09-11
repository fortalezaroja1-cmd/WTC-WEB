"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Boxes, ClipboardList, Package, Users, Settings, Store, LogOut, BellRing, Trello } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/crm", label: "CRM", icon: Trello },
  { href: "/admin/productos", label: "Productos", icon: Boxes },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/inventario", label: "Inventario", icon: Package },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/contenido", label: "Contenido", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [newOrders, setNewOrders] = useState(0);

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

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="w-[232px] bg-graphite text-[#C4CCD6] flex flex-col sticky top-0 h-screen shrink-0">
        <div className="p-5 pb-4 border-b border-slate-dark">
          <div className="font-display font-bold text-white text-[15px]">WIRED<span className="text-copper">·</span>TECH</div>
          <div className="font-mono text-[9px] tracking-[.12em] text-muted mt-0.5">PANEL ADMINISTRATIVO</div>
        </div>
        <nav className="flex-1 p-2.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
            const showBadge = href === "/admin/pedidos" || href === "/admin/crm";
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13.5px] font-medium mb-0.5 transition-colors ${
                  active ? "bg-slate-dark text-white" : "hover:bg-slate-dark/50"
                }`}>
                <Icon size={17} />
                <span className="flex-1">{label}</span>
                {showBadge && newOrders > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-copper text-white text-[10px] font-bold flex items-center justify-center">{newOrders}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-2.5 border-t border-slate-dark">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] hover:bg-slate-dark/50 transition-colors">
            <Store size={17} /> Ver tienda
          </Link>
          <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13.5px] hover:bg-slate-dark/50 transition-colors text-left">
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        {newOrders > 0 && pathname !== "/admin/pedidos" && pathname !== "/admin/crm" && (
          <Link href="/admin/crm" className="mx-7 mt-5 flex items-center gap-2 rounded-lg border border-copper/30 bg-amber-50 px-4 py-3 text-sm font-semibold text-slate-dark hover:border-copper transition-colors">
            <BellRing size={16} className="text-copper" />
            {newOrders} pedido{newOrders === 1 ? " nuevo" : "s nuevos"} sin revisar
          </Link>
        )}
        <div className="p-7">{children}</div>
      </main>
    </div>
  );
}
