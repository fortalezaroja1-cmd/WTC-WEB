"use client";
import { useEffect, useState } from "react";

const RULES = [
  { key: "newOrderTask", title: "Pedido nuevo → tarea inmediata", desc: "Crea un pendiente operativo para revisar y asignar cada pedido nuevo." },
  { key: "followup24h", title: "Revisado sin cierre → seguimiento 24h", desc: "Si un pedido sigue en Revisado después de 24 horas, aparece como seguimiento pendiente." },
  { key: "postSale48h", title: "Entregado → postventa 24–72h", desc: "Genera seguimiento de satisfacción y oportunidad de recompra." },
  { key: "unassignedAlert", title: "Sin responsable → alerta", desc: "Destaca oportunidades que todavía no tienen vendedor asignado." },
  { key: "lowStockAlert", title: "Stock mínimo → alerta", desc: "Marca productos que alcanzan su nivel mínimo configurado." },
];

export default function AutomatizacionesPage() {
  const [cfg, setCfg] = useState<Record<string, boolean>>({ newOrderTask:true, followup24h:true, postSale48h:true, unassignedAlert:true, lowStockAlert:true });
  const [saved, setSaved] = useState(false);
  useEffect(() => { fetch("/api/admin/settings").then(r=>r.json()).then(s=>{ try { setCfg(c=>({ ...c, ...JSON.parse(s.crmAutomations || "{}") })); } catch {} }); }, []);
  const toggle = async (key:string) => {
    const next = { ...cfg, [key]: !cfg[key] };
    setCfg(next);
    await fetch("/api/admin/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ crmAutomations: JSON.stringify(next) }) });
    setSaved(true); setTimeout(()=>setSaved(false), 1600);
  };
  return <div className="max-w-[920px]">
    <div className="mb-5"><h1 className="font-display text-2xl font-bold">Automatizaciones</h1><p className="text-sm text-muted mt-1">Reglas comerciales que alimentan tareas y alertas del panel.</p></div>
    <div className="bg-white border border-hair rounded-xl overflow-hidden divide-y divide-hair">
      {RULES.map(r => <div key={r.key} className="p-5 flex items-center gap-5">
        <div className="flex-1"><div className="font-semibold text-sm">{r.title}</div><div className="text-xs text-muted mt-1">{r.desc}</div></div>
        <button onClick={()=>toggle(r.key)} className={`w-12 h-7 rounded-full p-1 transition-colors ${cfg[r.key] ? "bg-green" : "bg-[#CDD2D8]"}`}>
          <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${cfg[r.key] ? "translate-x-5" : ""}`} />
        </button>
      </div>)}
    </div>
    <div className="mt-4 flex items-center justify-between text-xs text-muted">
      <span>Las reglas activas se reflejan en Tareas y en las alertas operativas del panel.</span>
      {saved && <span className="text-green font-semibold">Guardado</span>}
    </div>
  </div>;
}
