"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, Bot, CheckCircle2, Filter, GitBranch, ShieldCheck } from "lucide-react";

type StrategyData = {
  version?: string;
  strategy?: any;
  pricing?: {
    publishedProducts?: number;
    activePromotions?: number;
    promotions?: Array<{ product: string; sku: string; regular: number | null; promo: number }>;
    rule?: string;
  };
};

const FLOW = [
  ["1. Entrada", "Recibe WhatsApp, evita duplicados y separa ausencia vs. horario laboral."],
  ["2. Identificación", "Detecta intención y producto. Si hay ambigüedad, pregunta antes de cotizar."],
  ["3. Calificación", "Exige producto exacto, cantidad, ciudad y urgencia."],
  ["4. Precio/stock", "Lee catálogo real. No inventa precios, descuentos ni inventario."],
  ["5. Cotización", "Calcula producto; el envío debe venir de logística/Skydropx antes de marcar COTIZADO."],
  ["6. Datos de cierre", "Solicita dirección, barrio y color cuando aplica."],
  ["7. Confirmación", "Resume el pedido y exige confirmación expresa."],
  ["8. CAP · C", "Con confirmación, pasa a POR-CERRAR. La guía no se genera antes."],
  ["9. CAP · A", "Si falta algo, registra el siguiente paso y cuándo debe revisarse."],
  ["10. CAP · P", "Sin respuesta: mensaje → llamada → último mensaje. Máximo tres intentos."],
];

function money(value: number | null | undefined) {
  if (value == null) return "—";
  return Number(value).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default function AgentStrategyPage() {
  const [data, setData] = useState<StrategyData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/agent/strategy", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "No se pudo cargar la estrategia");
      setData(body);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la estrategia");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const strategy = data.strategy || {};
  const promptEquivalent = useMemo(() => JSON.stringify({
    motor: strategy.engine,
    lenguaje: strategy.language,
    calificacion: strategy.qualification,
    cotizacion: strategy.quote,
    cierre: strategy.close,
    CAP: strategy.cap,
    precios: strategy.pricing,
    filtros: strategy.safetyFilters,
  }, null, 2), [strategy]);

  return <div className="max-w-[1180px] mx-auto">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2"><Bot size={22} className="text-copper"/><h1 className="font-display text-2xl font-bold">Estrategia del agente</h1></div>
        <p className="text-sm text-muted mt-1">Reglas reales que gobiernan respuestas, filtros, precios, CAP y escalamiento.</p>
      </div>
      <Link href="/admin/agente" className="inline-flex items-center gap-2 border border-hair bg-white rounded-lg px-3 py-2.5 text-sm font-semibold"><ArrowLeft size={15}/>Volver a probar agente</Link>
    </div>

    {error && <div className="mb-5 border border-red-100 bg-red-50 text-alert rounded-lg px-4 py-3 text-sm">{error}</div>}

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card icon={ShieldCheck} title="Motor" value={loading ? "…" : "Reglas determinísticas"} detail="No usa GPT para decidir ni consume tokens por respuesta." />
      <Card icon={GitBranch} title="Versión" value={loading ? "…" : (data.version || "—")} detail="Prueba y producción usan el mismo motor." />
      <Card icon={BadgeDollarSign} title="Promociones activas" value={loading ? "…" : String(data.pricing?.activePromotions || 0)} detail={`${data.pricing?.publishedProducts || 0} productos publicados.`} />
    </div>

    <section className="bg-white border border-hair rounded-xl p-5 mb-5">
      <h2 className="font-semibold">¿Qué “prompt” usa?</h2>
      <p className="text-sm text-muted mt-2 leading-relaxed">No existe un prompt enviado a un modelo de IA. El agente es un motor sin tokens. Su equivalente al prompt son estas reglas codificadas y versionadas; por eso puede auditarse exactamente.</p>
      <pre className="mt-4 bg-[#F7F8FA] border border-hair rounded-lg p-4 text-[11px] leading-relaxed overflow-auto max-h-[360px]">{loading ? "Cargando…" : promptEquivalent}</pre>
    </section>

    <section className="bg-white border border-hair rounded-xl p-5 mb-5">
      <div className="flex items-center gap-2"><GitBranch size={18} className="text-copper"/><h2 className="font-semibold">Flujo obligatorio</h2></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {FLOW.map(([title, detail]) => <div key={title} className="border border-hair rounded-lg p-4"><div className="text-sm font-semibold">{title}</div><div className="text-xs text-muted mt-1 leading-relaxed">{detail}</div></div>)}
      </div>
    </section>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
      <section className="bg-white border border-hair rounded-xl p-5">
        <div className="flex items-center gap-2"><Filter size={18} className="text-copper"/><h2 className="font-semibold">Filtros y bloqueos</h2></div>
        <div className="mt-4 space-y-2">{(strategy.safetyFilters || []).map((item: string) => <div key={item} className="flex items-start gap-2 text-sm"><CheckCircle2 size={15} className="text-green mt-0.5 shrink-0"/><span>{item}</span></div>)}</div>
      </section>
      <section className="bg-white border border-hair rounded-xl p-5">
        <h2 className="font-semibold">Lenguaje</h2>
        <div className="mt-4 space-y-3 text-sm">
          <Row label="Tono" value={strategy.language?.tone || "—"}/>
          <Row label="Máximo" value={`${strategy.language?.maxWords || 60} palabras`}/>
          <Row label="Preguntas" value={`máximo ${strategy.language?.maxQuestions || 1} por mensaje`}/>
          <Row label="Emojis" value={strategy.language?.emojis || "—"}/>
          <Row label="No usar con clientes" value={(strategy.language?.forbiddenInternalTerms || []).join(", ") || "—"}/>
        </div>
      </section>
    </div>

    <section className="bg-white border border-hair rounded-xl overflow-hidden mb-5">
      <div className="p-5 border-b border-hair"><h2 className="font-semibold">Precio y promociones</h2><p className="text-xs text-muted mt-1">{data.pricing?.rule || "Cargando reglas de precio…"}</p></div>
      {(data.pricing?.promotions || []).length ? <div className="divide-y divide-hair">{data.pricing!.promotions!.map((promo) => <div key={`${promo.sku}-${promo.product}`} className="p-4 flex items-center justify-between gap-4"><div><div className="text-sm font-semibold">{promo.product}</div><div className="text-[10px] text-muted font-mono">{promo.sku}</div></div><div className="text-right"><div className="text-xs text-muted line-through">{money(promo.regular)}</div><div className="text-sm font-bold text-copper">{money(promo.promo)}</div></div></div>)}</div> : <div className="p-6 text-sm text-muted">No hay promociones cargadas en <span className="font-mono">promoPrice</span>. El agente está usando precios regulares del catálogo.</div>}
    </section>

    <section className="bg-[#FFF9F4] border border-copper/20 rounded-xl p-5">
      <h2 className="font-semibold">Reglas que no puede romper</h2>
      <p className="text-sm mt-2 leading-relaxed">No adivinar producto ambiguo. No prometer stock inexistente. No inventar descuento. No afirmar originalidad sin dato explícito. No marcar COTIZADO sin envío. No generar guía antes de confirmación. Reclamos, dudas de autenticidad sin validar y excepciones comerciales pasan a humano.</p>
    </section>
  </div>;
}

function Card({icon:Icon,title,value,detail}:{icon:any,title:string,value:string,detail:string}){return <div className="bg-white border border-hair rounded-xl p-4"><div className="flex items-center gap-2 text-muted"><Icon size={16}/><span className="text-[10px] uppercase tracking-wider font-semibold">{title}</span></div><div className="font-display text-xl font-bold mt-2">{value}</div><div className="text-[11px] text-muted mt-1">{detail}</div></div>}
function Row({label,value}:{label:string,value:string}){return <div className="flex items-start justify-between gap-4 border-b border-hair pb-2 last:border-0"><span className="text-xs text-muted">{label}</span><span className="text-xs font-medium text-right max-w-[68%]">{value}</span></div>}
