"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Plus, Trash2 } from "lucide-react";

const DEFAULT_AUTOMATIONS = { newOrderTask: true, followup24h: true, postSale48h: true };

export default function TareasPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [automations, setAutomations] = useState(DEFAULT_AUTOMATIONS);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState("");

  const load = async () => {
    const [o, s] = await Promise.all([
      fetch("/api/admin/orders", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/admin/settings", { cache: "no-store" }).then(r => r.json()),
    ]);
    setOrders(Array.isArray(o) ? o : []);
    try { setTasks(JSON.parse(s.crmTasks || "[]")); } catch { setTasks([]); }
    try { setAutomations({ ...DEFAULT_AUTOMATIONS, ...JSON.parse(s.crmAutomations || "{}") }); } catch {}
  };
  useEffect(() => { load(); }, []);

  const save = async (next: any[]) => {
    setTasks(next);
    await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crmTasks: JSON.stringify(next) }) });
  };

  const add = async () => {
    if (!title.trim()) return;
    await save([{ id: crypto.randomUUID(), title: title.trim(), due: due || null, owner: owner || null, status: "OPEN", createdAt: new Date().toISOString() }, ...tasks]);
    setTitle(""); setDue(""); setOwner("");
  };

  const systemTasks = useMemo(() => {
    const now = Date.now();
    const out: any[] = [];
    for (const o of orders) {
      const ageH = (now - new Date(o.updatedAt || o.createdAt).getTime()) / 36e5;
      if (automations.newOrderTask && o.shipStatus === "PENDING_PAYMENT") out.push({ id: `new-${o.id}`, title: `Revisar pedido ${o.number}`, detail: o.customer?.name, orderId: o.id, kind: "Pedido nuevo" });
      if (automations.followup24h && o.shipStatus === "READY" && ageH >= 24) out.push({ id: `f24-${o.id}`, title: `Seguimiento 24h · ${o.number}`, detail: o.customer?.name, orderId: o.id, kind: "Seguimiento" });
      if (o.shipStatus === "APPROVED" || o.shipStatus === "PREPARING") out.push({ id: `prep-${o.id}`, title: `Verificar alistamiento · ${o.number}`, detail: o.customer?.name, orderId: o.id, kind: "Operación" });
      if (automations.postSale48h && o.shipStatus === "DELIVERED" && ageH >= 24 && ageH <= 96) out.push({ id: `post-${o.id}`, title: `Postventa 24–72h · ${o.number}`, detail: o.customer?.name, orderId: o.id, kind: "Postventa" });
    }
    return out;
  }, [orders, automations]);

  const open = tasks.filter(t => t.status !== "DONE");
  const done = tasks.filter(t => t.status === "DONE");

  return <div className="max-w-[1100px]">
    <div className="flex items-end justify-between gap-4 mb-5">
      <div><h1 className="font-display text-2xl font-bold">Tareas</h1><p className="text-sm text-muted mt-1">Seguimientos, llamadas y pendientes del equipo comercial.</p></div>
      <div className="text-xs bg-white border border-hair rounded-lg px-3 py-2"><b>{systemTasks.length + open.length}</b> pendientes</div>
    </div>

    <div className="bg-white border border-hair rounded-xl p-4 mb-5 grid grid-cols-1 md:grid-cols-[1fr_180px_180px_auto] gap-2">
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nueva tarea..." className="border border-hair rounded-lg px-3 py-2.5 text-sm" />
      <input value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Responsable" className="border border-hair rounded-lg px-3 py-2.5 text-sm" />
      <input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} className="border border-hair rounded-lg px-3 py-2.5 text-sm" />
      <button onClick={add} className="bg-copper text-white rounded-lg px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2"><Plus size={15}/> Crear</button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="bg-white border border-hair rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-hair"><h2 className="font-semibold">Automáticas</h2><p className="text-xs text-muted">Se generan a partir del estado real de los pedidos.</p></div>
        <div className="divide-y divide-hair">
          {systemTasks.length === 0 && <div className="p-6 text-sm text-muted">No hay tareas automáticas pendientes.</div>}
          {systemTasks.map(t => <div key={t.id} className="p-4 flex items-center justify-between gap-4">
            <div><div className="text-sm font-semibold">{t.title}</div><div className="text-xs text-muted mt-1">{t.kind} · {t.detail || "Sin cliente"}</div></div>
            <Link href={`/admin/pedidos`} className="text-xs font-semibold text-copper">Abrir</Link>
          </div>)}
        </div>
      </section>

      <section className="bg-white border border-hair rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-hair"><h2 className="font-semibold">Manuales</h2><p className="text-xs text-muted">Pendientes creados por el equipo.</p></div>
        <div className="divide-y divide-hair">
          {open.length === 0 && <div className="p-6 text-sm text-muted">No hay tareas manuales pendientes.</div>}
          {open.map(t => <div key={t.id} className="p-4 flex items-start gap-3">
            <button onClick={()=>save(tasks.map(x=>x.id===t.id?{...x,status:"DONE"}:x))} className="mt-0.5 w-6 h-6 rounded-full border border-hair flex items-center justify-center hover:border-copper"><Check size={13}/></button>
            <div className="flex-1"><div className="text-sm font-semibold">{t.title}</div><div className="text-xs text-muted mt-1">{t.owner || "Sin responsable"}{t.due ? ` · ${new Date(t.due).toLocaleString("es-CO")}` : ""}</div></div>
            <button onClick={()=>save(tasks.filter(x=>x.id!==t.id))} className="text-muted hover:text-alert"><Trash2 size={15}/></button>
          </div>)}
        </div>
      </section>
    </div>

    {done.length > 0 && <div className="mt-5 text-xs text-muted">Completadas: {done.length}</div>}
  </div>;
}
