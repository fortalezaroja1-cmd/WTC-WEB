"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

const CLASSIFICATIONS = {
  A: "A · Error nuestro",
  B: "B · Daño transporte",
  C: "C · Compatibilidad / inconformidad",
};

export default function DevolucionesPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [classification, setClassification] = useState("C");
  const [evidence, setEvidence] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/orders", { cache:"no-store" }).then(r=>r.json()),
      fetch("/api/admin/settings", { cache:"no-store" }).then(r=>r.json()),
    ]).then(([o,s])=>{
      setOrders(Array.isArray(o)?o:[]);
      try { setCases(JSON.parse(s.returnCases || "[]")); } catch { setCases([]); }
    });
  }, []);

  const save = async (next:any[]) => {
    setCases(next);
    await fetch("/api/admin/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ returnCases: JSON.stringify(next) }) });
  };
  const createCase = async () => {
    const order = orders.find(o=>o.id===orderId);
    if (!order || !reason.trim()) return;
    const item = { id:crypto.randomUUID(), number:`DEV-${String(cases.length+1).padStart(4,"0")}`, orderId, orderNumber:order.number, customer:order.customer?.name || "Cliente", phone:order.customer?.phone || "", reason:reason.trim(), classification, evidence:evidence.trim(), status:"ABIERTO", createdAt:new Date().toISOString() };
    await save([item, ...cases]);
    setOrderId(""); setReason(""); setEvidence(""); setClassification("C");
  };
  const updateStatus = (id:string,status:string) => save(cases.map(c=>c.id===id?{...c,status}:c));
  const openCases = cases.filter(c=>c.status!=="CERRADO");

  return <div className="max-w-[1100px]">
    <div className="mb-5"><h1 className="font-display text-2xl font-bold">Devoluciones y reclamos</h1><p className="text-sm text-muted mt-1">Cada caso queda vinculado a un pedido, motivo, evidencia y decisión.</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
      <div className="bg-white border border-hair rounded-xl p-5 h-fit space-y-3">
        <h2 className="font-semibold">Registrar caso</h2>
        <select value={orderId} onChange={e=>setOrderId(e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm"><option value="">Seleccionar pedido</option>{orders.map(o=><option key={o.id} value={o.id}>{o.number} · {o.customer?.name}</option>)}</select>
        <select value={classification} onChange={e=>setClassification(e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm">{Object.entries(CLASSIFICATIONS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Motivo del reclamo o devolución" rows={4} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm resize-none" />
        <input value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Evidencia / link de fotos (opcional)" className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm" />
        <button onClick={createCase} className="w-full bg-copper text-white rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2"><Plus size={15}/> Crear caso</button>
      </div>

      <div className="bg-white border border-hair rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-hair flex items-center justify-between"><div><h2 className="font-semibold">Casos</h2><p className="text-xs text-muted">{openCases.length} abiertos</p></div></div>
        <div className="divide-y divide-hair">
          {cases.length===0 && <div className="p-8 text-sm text-muted">No hay devoluciones registradas.</div>}
          {cases.map(c=><div key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-mono text-[10px] text-muted">{c.number} · {c.orderNumber}</div><div className="font-semibold text-sm mt-1">{c.customer}</div><div className="text-xs mt-1">{c.reason}</div><div className="text-[10px] text-muted mt-2">{CLASSIFICATIONS[c.classification as keyof typeof CLASSIFICATIONS] || c.classification} · {new Date(c.createdAt).toLocaleString("es-CO")}</div>{c.evidence && <div className="text-[10px] text-copper mt-1">Evidencia: {c.evidence}</div>}</div>
              <select value={c.status} onChange={e=>updateStatus(c.id,e.target.value)} className="border border-hair rounded-lg px-2 py-1.5 text-xs"><option>ABIERTO</option><option>EN REVISION</option><option>SOLUCIONADO</option><option>CERRADO</option></select>
            </div>
          </div>)}
        </div>
      </div>
    </div>
  </div>;
}
