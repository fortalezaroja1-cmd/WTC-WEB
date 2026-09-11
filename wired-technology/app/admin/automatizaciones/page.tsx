"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const RULES = [
  { key: "newOrderTask", title: "Pedido nuevo → tarea inmediata", desc: "Crea un pendiente operativo para revisar y asignar cada pedido nuevo." },
  { key: "followup24h", title: "Revisado sin cierre → seguimiento 24h", desc: "Si un pedido sigue en Revisado después de 24 horas, aparece como seguimiento pendiente." },
  { key: "postSale48h", title: "Entregado → postventa 24–72h", desc: "Genera seguimiento de satisfacción y oportunidad de recompra." },
  { key: "unassignedAlert", title: "Sin responsable → alerta", desc: "Destaca oportunidades que todavía no tienen vendedor asignado." },
  { key: "lowStockAlert", title: "Stock mínimo → alerta", desc: "Marca productos que alcanzan su nivel mínimo configurado." },
];

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

type AwayConfig = {
  enabled: boolean;
  message: string;
  selfServiceUrl: string;
  activeDays: number[];
  cooldownHours: number;
  timezone: string;
};

const DEFAULT_AWAY: AwayConfig = {
  enabled: true,
  message: "En este momento estamos fuera de horario. Puedes armar tu pedido directamente en nuestra página y dejar tus datos. El equipo lo retoma al iniciar la jornada. Tenemos pago en casa / contraentrega.",
  selfServiceUrl: "",
  activeDays: [1, 2, 3, 4, 5, 6],
  cooldownHours: 8,
  timezone: "America/Bogota",
};

export default function AutomatizacionesPage() {
  const [cfg, setCfg] = useState<Record<string, boolean>>({ newOrderTask:true, followup24h:true, postSale48h:true, unassignedAlert:true, lowStockAlert:true });
  const [away, setAway] = useState<AwayConfig>(DEFAULT_AWAY);
  const [workStart, setWorkStart] = useState("08:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [saved, setSaved] = useState(false);
  const [awaySaving, setAwaySaving] = useState(false);
  const [awaySaved, setAwaySaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r=>r.json())
      .then(s=>{
        try { setCfg(c=>({ ...c, ...JSON.parse(s.crmAutomations || "{}") })); } catch {}
        setWorkStart(s.workStart || "08:00");
        setWorkEnd(s.workEnd || "18:00");
        try {
          const parsed = JSON.parse(s.awayMessageConfig || "{}");
          setAway({
            ...DEFAULT_AWAY,
            selfServiceUrl: typeof window !== "undefined" ? window.location.origin : "",
            ...parsed,
            activeDays: Array.isArray(parsed.activeDays) ? parsed.activeDays : DEFAULT_AWAY.activeDays,
          });
        } catch {
          setAway({ ...DEFAULT_AWAY, selfServiceUrl: typeof window !== "undefined" ? window.location.origin : "" });
        }
      });
  }, []);

  const toggle = async (key:string) => {
    const next = { ...cfg, [key]: !cfg[key] };
    setCfg(next);
    await fetch("/api/admin/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ crmAutomations: JSON.stringify(next) }) });
    setSaved(true); setTimeout(()=>setSaved(false), 1600);
  };

  const toggleDay = (day:number) => {
    setAway(current => ({
      ...current,
      activeDays: current.activeDays.includes(day)
        ? current.activeDays.filter(item => item !== day)
        : [...current.activeDays, day],
    }));
  };

  const saveAway = async () => {
    setAwaySaving(true);
    await fetch("/api/admin/settings", {
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ awayMessageConfig: JSON.stringify(away) }),
    });
    setAwaySaving(false);
    setAwaySaved(true);
    setTimeout(()=>setAwaySaved(false), 1800);
  };

  const preview = `${away.message.trim()}${away.selfServiceUrl.trim() ? `\n\n${away.selfServiceUrl.trim()}` : ""}`;

  return <div className="max-w-[920px]">
    <div className="mb-5"><h1 className="font-display text-2xl font-bold">Automatizaciones</h1><p className="text-sm text-muted mt-1">Reglas comerciales, respuestas automáticas y alertas del panel.</p></div>

    <div className="bg-white border border-hair rounded-xl p-5 mb-5">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="font-semibold text-base">Mensaje de ausencia + autoatención</div>
          <p className="text-xs text-muted mt-1 leading-relaxed">Fuera del horario laboral, WhatsApp envía este mensaje con el enlace de la tienda y pausa la respuesta normal del agente para evitar mensajes dobles.</p>
        </div>
        <button onClick={()=>setAway(a=>({...a,enabled:!a.enabled}))} className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${away.enabled ? "bg-green" : "bg-[#CDD2D8]"}`}>
          <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${away.enabled ? "translate-x-5" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold block mb-1">Mensaje automático</label>
          <textarea value={away.message} onChange={e=>setAway({...away,message:e.target.value})} rows={4} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper resize-y" />
          <div className="text-[11px] text-muted mt-1">El link se agrega al final automáticamente. También puedes escribir <span className="font-mono">{"{{link}}"}</span> dentro del texto para decidir dónde aparece.</div>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-semibold block mb-1">Link para que el cliente arme el pedido</label>
          <input type="url" value={away.selfServiceUrl} onChange={e=>setAway({...away,selfServiceUrl:e.target.value})} placeholder="https://..." className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-2">Días con atención</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(day => <button key={day.value} onClick={()=>toggleDay(day.value)} className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${away.activeDays.includes(day.value) ? "bg-copper text-white border-copper" : "bg-white text-muted border-hair"}`}>{day.label}</button>)}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">No repetir al mismo cliente durante</label>
          <div className="flex items-center gap-2"><input type="number" min={1} max={72} value={away.cooldownHours} onChange={e=>setAway({...away,cooldownHours:Math.max(1,Number(e.target.value)||1)})} className="w-24 border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper"/><span className="text-xs text-muted">horas</span></div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4">
        <div className="rounded-lg border border-hair bg-[#FAFAFA] p-4">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted">Vista previa</div>
          <div className="text-sm whitespace-pre-wrap mt-2 leading-relaxed">{preview || "Configura el mensaje y el enlace."}</div>
        </div>
        <div className="rounded-lg border border-hair p-4">
          <div className="text-xs font-semibold">Horario que activa la ausencia</div>
          <div className="text-lg font-bold mt-1">{workStart} – {workEnd}</div>
          <p className="text-[11px] text-muted mt-1">Zona horaria: Colombia. En los días no seleccionados se considera ausencia todo el día.</p>
          <Link href="/admin/configuracion" className="text-xs font-semibold text-copper inline-block mt-2">Cambiar horario laboral →</Link>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={saveAway} disabled={awaySaving} className="bg-copper text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{awaySaving?"Guardando...":"Guardar mensaje de ausencia"}</button>
        {awaySaved && <span className="text-xs font-semibold text-green">Guardado</span>}
      </div>
    </div>

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
