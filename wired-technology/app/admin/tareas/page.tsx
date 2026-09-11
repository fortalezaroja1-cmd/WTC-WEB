"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Plus, Trash2 } from "lucide-react";

const DEFAULT_AUTOMATIONS = { newOrderTask: true, followup24h: true, postSale48h: true, capTasks: true };

export default function TareasPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [automations, setAutomations] = useState(DEFAULT_AUTOMATIONS);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState("");

  const load = async () => {
    const [o, l, s] = await Promise.all([
      fetch("/api/admin/orders", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/admin/crm/leads", { cache: "no-store" }).then(r => r.json()).catch(() => []),
      fetch("/api/admin/settings", { cache: "no-store" }).then(r => r.json()),
    ]);
    setOrders(Array.isArray(o) ? o : []);
    setLeads(Array.isArray(l) ? l : []);
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

    for (const lead of leads) {
      if (!automations.capTasks) break;
      const seller = lead.assignedSellerName || "Sin responsable";
      if (lead.capPending !== false && lead.lastOutboundAt) {
        out.push({
          id: `cap-${lead.id}`,
          title: `Resolver CAP · ${lead.name || lead.phone || "Lead"}`,
          detail: `${seller} · Paso ${lead.capStep || "C"}`,
          href: "/admin/inbox",
          kind: "CAP obligatorio",
          priority: 0,
        });
      } else if (lead.capPending === false && ["A", "P"].includes(lead.capDecision) && lead.capNextAt && !["CLOSED", "LOST"].includes(lead.status)) {
        const dueAt = new Date(lead.capNextAt).getTime();
        const overdue = dueAt <= now;
        out.push({
          id: `cap-follow-${lead.id}`,
          title: `${overdue ? "Vencido" : "Próximo"} · ${lead.capNextStep || "Seguimiento CAP"}`,
          detail: `${lead.name || lead.phone || "Lead"} · ${seller} · ${new Date(lead.capNextAt).toLocaleString("es-CO")}`,
          href: "/admin/inbox",
          kind: lead.capDecision === "A" ? "CAP · Acordado" : "CAP · Planeado",
          priority: overdue ? 1 : 2,
        });
      }
    }

    for (const o of orders) {
      const ageH = (now - new Date(o.updatedAt || o.createdAt).getTime()) / 36e5;
      if (automations.newOrderTask && o.shipStatus === "PENDING_PAYMENT") out.push({ id: `new-${o.id}`, title: `Revisar pedido ${o.number}`, detail: o.customer?.name, href: "/admin/pedidos", kind: "Pedido nuevo", priority: 3 });
      if (automations.followup24h && o.shipStatus === "READY" && ageH >= 24) out.push({ id: `f24-${o.id}`, title: `Seguimiento 24h · ${o.number}`, detail: o.customer?.name, href: "/admin/pedidos", kind: "Seguimiento", priority: 4 });
      if (o.shipStatus === "APPROVED" || o.shipStatus === "PREPARING") out.push({ id: `prep-${o.id}`, title: `Verificar alistamiento · ${o.number}`, detail: o.customer?.name, href: "/admin/pedidos", kind: "Operación", priority: 5 });
      if (automations.postSale48h && o.shipStatus === "DELIVERED" && ageH >= 24 && ageH <= 96) out.push({ id: `post-${o.id}`, title: `Postventa 24–72h · ${o.number}`, detail: o.customer?.name, href: "/admin/pedidos", kind: "Postventa", priority: 6 });
    }
    return out.sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
  }, [orders, leads, automations]);

  const open = tasks.filter(t => t.status !== "DONE");
  const done = tasks.filter(t => t.status === "DONE");

  return <div className="max-w-[1100px]">
    <div className="flex items-end justify-between gap-4 mb-5">
      <div><h1 className="font-display text-2xl font-bold">Tareas</h1><p className="text-sm text-muted mt-1">Seguimientos, llamadas, CAP pendiente y tareas operativas.</p></div>
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
        <div className="px-4 py-3 border-b border-hair"><h2 className="font-semibold">Automáticas</h2><p className="text-xs text-muted">CAP tiene prioridad: una conversación no termina sin Cerrar, Acordar o Planear.</p></div>
        <div className="divide-y divide-hair">
          {systemTasks.length === 0 && <div className="p-6 text-sm text-muted">No hay tareas automáticas pendientes.</div>}
          {systemTasks.map(t => <div key={t.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0"><div className="text-sm font-semibold break-words">{t.title}</div><div className="text-xs text-muted mt-1 break-words">{t.kind} · {t.detail || "Sin cliente"}</div></div>
            <Link href={t.href || "/admin/pedidos"} className="text-xs font-semibold text-copper shrink-0">Abrir</Link>
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