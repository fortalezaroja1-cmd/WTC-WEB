"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  UserRound,
  MessageCircle,
  Inbox,
  UserX,
  Clock3,
  EyeOff,
  Tag,
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { formatCOP, SHIP_LABELS, timeAgo, waLink } from "@/lib/utils";

const FILTERS = [
  { id: "ALL", label: "Todo", icon: Inbox },
  { id: "UNASSIGNED", label: "Sin asignar", icon: UserX },
  { id: "UNANSWERED", label: "Sin responder", icon: Clock3 },
  { id: "FOLLOWUP", label: "Seguimiento", icon: MessageCircle },
  { id: "UNREAD", label: "No leído", icon: EyeOff },
] as const;

export default function InboxPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ALL");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"HUMAN" | "AUTO">("HUMAN");

  const load = async () => {
    const res = await fetch("/api/admin/orders", { cache: "no-store" });
    if (res.ok) setOrders(await res.json());
  };

  useEffect(() => {
    load();
    fetch("/api/admin/sales-users", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSellers)
      .catch(() => setSellers([]));
  }, []);

  const current = useMemo(() => orders.find((o) => o.id === selected), [orders, selected]);

  const counts = useMemo(() => {
    const unanswered = orders.filter((o) => !(o.history || []).some((h: any) => h.actor === "admin")).length;
    return {
      ALL: orders.length,
      UNASSIGNED: orders.filter((o) => !o.workflow?.assignedSellerId).length,
      UNANSWERED: unanswered,
      FOLLOWUP: orders.filter((o) => ["READY", "APPROVED"].includes(o.shipStatus)).length,
      UNREAD: orders.filter((o) => o.shipStatus === "PENDING_PAYMENT").length,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "UNASSIGNED" && o.workflow?.assignedSellerId) return false;
      if (filter === "UNANSWERED" && (o.history || []).some((h: any) => h.actor === "admin")) return false;
      if (filter === "FOLLOWUP" && !["READY", "APPROVED"].includes(o.shipStatus)) return false;
      if (filter === "UNREAD" && o.shipStatus !== "PENDING_PAYMENT") return false;
      if (!text) return true;
      const haystack = [o.number, o.customer?.name, o.customer?.phone, o.customer?.city, o.workflow?.origin]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(text);
    });
  }, [orders, filter, query]);

  const update = async (id: string, payload: any) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  };

  const openConversation = async (order: any) => {
    setSelected(order.id);
    if (order.shipStatus === "PENDING_PAYMENT") {
      await update(order.id, { shipStatus: "READY" });
    }
  };

  const lastActivity = (o: any) => {
    const h = (o.history || [])[0];
    return h?.action || `Pedido ${o.number}`;
  };

  return (
    <div className="-m-7 h-[calc(100vh-0px)] min-h-[680px] bg-white border-t border-hair flex overflow-hidden">
      <aside className="w-[205px] border-r border-hair bg-[#F8F9FA] shrink-0 flex flex-col">
        <div className="px-4 py-4 border-b border-hair">
          <div className="font-display font-bold text-base">Bandeja</div>
          <div className="text-[11px] text-muted mt-0.5">Clientes y pedidos</div>
        </div>
        <div className="p-2.5 space-y-1">
          {FILTERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${filter === id ? "bg-white border border-hair shadow-sm font-semibold" : "hover:bg-white"}`}
            >
              <Icon size={15} className={filter === id ? "text-copper" : "text-muted"} />
              <span className="flex-1">{label}</span>
              <span className="font-mono text-[10px] text-muted">{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto p-3 border-t border-hair">
          <Link href="/admin/crm" className="text-xs font-semibold text-copper flex items-center gap-1 hover:underline">
            Ver pipeline <ChevronRight size={12} />
          </Link>
        </div>
      </aside>

      <section className="w-[390px] border-r border-hair shrink-0 flex flex-col bg-white">
        <div className="p-3 border-b border-hair space-y-2.5">
          <div className="flex items-center gap-2">
            <button onClick={() => setMode("HUMAN")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${mode === "HUMAN" ? "border-copper bg-copper/5 text-copper" : "border-hair text-muted"}`}>Humano</button>
            <button onClick={() => setMode("AUTO")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${mode === "AUTO" ? "border-copper bg-copper/5 text-copper" : "border-hair text-muted"}`}>Automático</button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente, teléfono, pedido..."
              className="w-full border border-hair rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-copper"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {mode === "AUTO" && (
            <div className="m-3 border border-dashed border-hair rounded-lg p-4 text-xs text-muted">
              Los mensajes automáticos aparecerán aquí cuando conectemos los canales de Meta.
            </div>
          )}
          {mode === "HUMAN" && filtered.map((o) => {
            const active = selected === o.id;
            return (
              <button
                key={o.id}
                onClick={() => openConversation(o)}
                className={`w-full text-left px-4 py-3.5 border-b border-hair hover:bg-paper/60 transition-colors ${active ? "bg-[#F2F5F7] border-l-2 border-l-copper" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#E9EDF1] flex items-center justify-center shrink-0 text-muted"><UserRound size={18}/></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-[13px] truncate">{o.customer?.name || "Cliente sin nombre"}</div>
                      <div className="font-mono text-[9px] text-muted whitespace-nowrap">{timeAgo(o.createdAt)}</div>
                    </div>
                    <div className="text-[11px] text-muted truncate mt-1">{lastActivity(o)}</div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[9px] rounded-full bg-paper px-2 py-1 text-muted">{o.workflow?.origin || "Web"}</span>
                      {o.shipStatus === "PENDING_PAYMENT" && <span className="w-2 h-2 rounded-full bg-copper" />}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {mode === "HUMAN" && filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-muted">No hay conversaciones para este filtro.</div>
          )}
        </div>
      </section>

      <main className="flex-1 min-w-[430px] flex flex-col bg-[#FAFBFC]">
        {!current ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-muted">
            <MessageCircle size={42} strokeWidth={1.2} className="mb-3" />
            <div className="font-semibold text-slate-dark">Selecciona una conversación</div>
            <div className="text-xs mt-1 max-w-[360px]">Aquí verás el historial comercial del cliente y, cuando conectemos Meta, los mensajes reales del canal.</div>
          </div>
        ) : (
          <>
            <header className="h-[72px] px-5 border-b border-hair bg-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{current.customer?.name}</div>
                <div className="text-[11px] text-muted mt-0.5">{current.workflow?.assignedSellerName ? `Asignado a ${current.workflow.assignedSellerName}` : "Sin vendedor asignado"}</div>
              </div>
              <a
                href={waLink(current.customer?.phone || "", `Hola ${current.customer?.name || ""}, te escribimos de Wired Technology sobre tu pedido ${current.number}.`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 bg-green text-white rounded-lg px-3 py-2 text-xs font-semibold"
              >
                <MessageCircle size={14}/> WhatsApp
              </a>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-center text-[10px] uppercase tracking-wider text-muted mb-5">Historial comercial</div>
              <div className="space-y-3 max-w-[720px] mx-auto">
                {[...(current.history || [])].reverse().map((h: any, i: number) => {
                  const admin = h.actor === "admin";
                  return (
                    <div key={h.id || i} className={`flex ${admin ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm border ${admin ? "bg-[#FFF7F0] border-copper/20" : "bg-white border-hair"}`}>
                        <div>{h.action}</div>
                        <div className="text-[9px] text-muted mt-1.5">{h.createdAt ? new Date(h.createdAt).toLocaleString("es-CO") : ""}</div>
                      </div>
                    </div>
                  );
                })}
                {(!current.history || current.history.length === 0) && (
                  <div className="text-center text-xs text-muted">Todavía no hay actividad registrada.</div>
                )}
              </div>
            </div>

            <div className="border-t border-hair bg-white p-4">
              <div className="border border-hair rounded-xl px-4 py-3 text-xs text-muted flex items-center justify-between gap-3">
                <span>Mensajería directa pendiente de conexión con Meta.</span>
                <span className="font-semibold text-copper whitespace-nowrap">Pago en casa activo</span>
              </div>
            </div>
          </>
        )}
      </main>

      <aside className="w-[330px] border-l border-hair bg-white shrink-0 overflow-y-auto">
        {!current ? (
          <div className="h-full flex items-center justify-center text-xs text-muted p-6 text-center">La ficha del contacto aparecerá aquí.</div>
        ) : (
          <div>
            <div className="p-5 border-b border-hair text-center">
              <div className="w-20 h-20 rounded-full bg-[#E9EDF1] mx-auto flex items-center justify-center text-muted"><UserRound size={34}/></div>
              <div className="font-semibold mt-3">{current.customer?.name}</div>
              <div className="text-[11px] text-muted mt-1">{current.number}</div>
            </div>

            <div className="p-5 space-y-5">
              <section className="space-y-2.5 text-xs">
                <InfoRow icon={Phone} label="Teléfono" value={current.customer?.phone || "—"}/>
                <InfoRow icon={Mail} label="Email" value={current.customer?.email || "—"}/>
                <InfoRow icon={MapPin} label="Ciudad" value={current.customer?.city || "—"}/>
              </section>

              <section>
                <div className="text-[11px] font-semibold mb-2">Responsable</div>
                <select
                  disabled={busy}
                  value={current.workflow?.assignedSellerId || ""}
                  onChange={(e) => {
                    const seller = sellers.find((s) => s.id === e.target.value);
                    update(current.id, { assignedSellerId: seller?.id || "", assignedSellerName: seller?.name || "" });
                  }}
                  className="w-full border border-hair rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-copper"
                >
                  <option value="">Sin asignar</option>
                  {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold">Etiquetas</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pill icon={Tag} text={current.workflow?.origin || "Web"}/>
                  <Pill icon={CheckCircle2} text="Contraentrega"/>
                  {current.workflow?.stockValidated ? <Pill icon={CheckCircle2} text="Stock OK"/> : <Pill icon={Circle} text="Stock pendiente"/>}
                </div>
              </section>

              <section>
                <div className="text-[11px] font-semibold mb-2">Pipeline</div>
                <Link href="/admin/crm" className="border border-hair rounded-lg p-3 flex items-center justify-between gap-2 hover:border-copper transition-colors">
                  <div>
                    <div className="text-xs font-semibold">{SHIP_LABELS[current.shipStatus] || current.shipStatus}</div>
                    <div className="text-[10px] text-muted mt-0.5">{formatCOP(Number(current.total))}</div>
                  </div>
                  <ChevronRight size={14} className="text-muted"/>
                </Link>
              </section>

              <section>
                <div className="text-[11px] font-semibold mb-2">Nota interna</div>
                <textarea
                  key={`${current.id}-${current.workflow?.internalNote || ""}`}
                  defaultValue={current.workflow?.internalNote || ""}
                  onBlur={(e) => update(current.id, { internalNote: e.target.value })}
                  rows={4}
                  placeholder="Añadir nota del vendedor..."
                  className="w-full border border-hair rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-copper"
                />
              </section>

              <section>
                <a
                  href={waLink(current.customer?.phone || "", `Hola ${current.customer?.name || ""}, te escribimos de Wired Technology sobre tu pedido ${current.number}.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full border border-hair rounded-lg px-3 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-copper"
                >
                  Abrir contacto <ExternalLink size={13}/>
                </a>
              </section>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={13} className="text-muted mt-0.5 shrink-0"/>
      <div className="min-w-0">
        <div className="text-[10px] text-muted">{label}</div>
        <div className="text-xs text-slate-dark break-words">{value}</div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, text }: { icon: any; text: string }) {
  return <span className="inline-flex items-center gap-1 bg-paper rounded-full px-2.5 py-1 text-[10px] text-slate-dark"><Icon size={10}/>{text}</span>;
}
