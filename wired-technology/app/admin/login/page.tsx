"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@wiredtech.co");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true); setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) { router.push("/admin"); }
    else { setError(data.error || "Error"); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-graphite flex items-center justify-center p-5">
      <div className="w-[360px]">
        <div className="text-center mb-6">
          <div className="font-display font-bold text-white text-xl">WIRED<span className="text-copper">·</span>TECHNOLOGY</div>
          <div className="font-mono text-[10px] tracking-[.14em] uppercase text-muted mt-1">Panel administrativo</div>
        </div>
        <div className="bg-card rounded-xl p-6">
          <div className="mb-3">
            <label className="text-xs font-semibold text-slate-dark block mb-1">Correo</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" />
          </div>
          <div className="mb-2">
            <label className="text-xs font-semibold text-slate-dark block mb-1">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Ingresa tu contraseña"
              className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" />
          </div>
          {error && <p className="text-alert text-xs mb-2">{error}</p>}
          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-copper text-white font-semibold py-3 rounded-lg mt-3 hover:bg-copper-bright transition-colors">
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </div>
        <Link href="/" className="flex items-center justify-center gap-1.5 text-muted text-sm mt-4 hover:text-copper transition-colors">
          <ArrowLeft size={14} /> Volver a la tienda
        </Link>
      </div>
    </div>
  );
}
