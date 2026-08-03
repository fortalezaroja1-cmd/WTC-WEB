"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Boxes, ClipboardList, Package, Users, Settings, Store, LogOut } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/productos", label: "Productos", icon: Boxes },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/inventario", label: "Inventario", icon: Package },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/contenido", label: "Contenido", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // No mostrar sidebar en login
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
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13.5px] font-medium mb-0.5 transition-colors ${
                  active ? "bg-slate-dark text-white" : "hover:bg-slate-dark/50"
                }`}>
                <Icon size={17} /> {label}
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
        <div className="p-7">{children}</div>
      </main>
    </div>
  );
}
