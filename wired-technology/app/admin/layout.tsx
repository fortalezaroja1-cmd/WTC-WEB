"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import AdminGlobalSearch from "@/components/AdminGlobalSearch";
import {
  Boxes,
  ClipboardList,
  Package,
  Store,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";

const NAV = [
  {
    href: "/admin/productos",
    label: "Productos",
    icon: Boxes,
    permission: "products.view",
  },
  {
    href: "/admin/inventario",
    label: "Inventario",
    icon: Package,
    permission: "inventory.view",
  },
  {
    href: "/admin/pedidos",
    label: "Pedidos",
    icon: ClipboardList,
    permission: "orders.view",
  },
];
type Session = { role: string; name: string; permissions: string[] };
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (pathname === "/admin/login") return;
    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setSession(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);
  if (pathname === "/admin/login") return <>{children}</>;
  const navigation = (
    <>
      <div className="p-5 border-b border-slate-dark">
        <div className="font-display font-bold text-white">
          WIRED · CATÁLOGO
        </div>
        <p className="text-xs text-muted mt-2">
          Productos, inventario y pedidos
        </p>
        {session && <p className="text-xs mt-3">{session.name}</p>}
      </div>
      <nav aria-label="Administración del catálogo" className="flex-1 p-3">
        {NAV.filter(
          (item) =>
            session?.role === "ADMIN" ||
            session?.permissions.includes(item.permission),
        ).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex gap-3 items-center p-3 rounded-lg mb-1 ${pathname === href ? "bg-slate-dark text-white" : "hover:bg-slate-dark/50"}`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-dark">
        <a
          href="https://www.wtgy.online/workspace"
          className="flex gap-3 items-center p-3 text-copper"
        >
          <ArrowUpRight size={18} />
          Abrir Wired CRM
        </a>
        <Link href="/" className="flex gap-3 items-center p-3">
          <Store size={18} />
          Ver catálogo
        </Link>
        <button
          onClick={async () => {
            const response = await fetch("/api/auth/logout", {
              method: "POST",
            });
            if (response.ok) {
              router.push("/admin/login");
              router.refresh();
            }
          }}
          className="flex gap-3 items-center p-3"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </>
  );
  return (
    <div className="min-h-screen bg-paper md:flex">
      <aside className="hidden md:flex w-[232px] bg-graphite text-[#C4CCD6] flex-col sticky top-0 h-screen shrink-0">
        {navigation}
      </aside>
      <header className="md:hidden bg-graphite text-white p-4 flex items-center gap-4">
        <button aria-label="Abrir menú" onClick={() => setMobileMenuOpen(true)}>
          <Menu size={22} />
        </button>
        <span>Administración del catálogo</span>
      </header>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[82vw] max-w-[310px] h-full flex flex-col bg-graphite text-[#C4CCD6]">
            <button
              aria-label="Cerrar navegación"
              onClick={() => setMobileMenuOpen(false)}
              className="self-end p-3"
            >
              <X size={22} />
            </button>
            {navigation}
          </aside>
        </div>
      )}
      <main className="flex-1 min-w-0 p-3 sm:p-5 md:p-7">
        <AdminGlobalSearch />
        {children}
      </main>
    </div>
  );
}
