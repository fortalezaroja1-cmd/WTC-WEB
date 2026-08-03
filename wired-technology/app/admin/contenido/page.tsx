"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

const FIELDS = [
  { key: "storeName", label: "Nombre de la tienda" },
  { key: "tagline", label: "Lema / subtítulo" },
  { key: "whatsapp", label: "WhatsApp (con código de país, ej: 573001234567)" },
  { key: "city", label: "Ciudad" },
  { key: "shippingCost", label: "Costo de envío ($)" },
  { key: "freeShipFrom", label: "Envío gratis desde ($)" },
];

export default function ContenidoAdmin() {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetch("/api/admin/settings").then((r) => r.json()).then(setCfg); }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-[560px]">
      <h1 className="font-display text-xl font-bold mb-5">Contenido de la tienda</h1>
      <div className="bg-card border border-hair rounded-xl p-6 space-y-4">
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-slate-dark block mb-1">{label}</label>
            <input value={cfg[key] || ""} onChange={(e) => setCfg({ ...cfg, [key]: e.target.value })}
              className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" />
          </div>
        ))}
        <button onClick={save} disabled={saving}
          className="bg-copper text-white font-semibold text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-copper-bright transition-colors">
          <Check size={15} /> {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && <p className="text-green text-xs font-semibold">Cambios guardados.</p>}
      </div>
    </div>
  );
}
