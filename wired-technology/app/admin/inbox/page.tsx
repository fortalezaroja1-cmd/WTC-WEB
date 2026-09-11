"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  EyeOff,
  Inbox,
  MessageCircle,
  Phone,
  RefreshCcw,
  Search,
  Send,
  Tag,
  UserRound,
  UserX,
} from "lucide-react";
import { timeAgo, waLink } from "@/lib/utils";

type FilterId = "ALL" | "UNREAD" | "UNASSIGNED" | "UNANSWERED" | "CAP";

const FILTERS: Array<{ id: FilterId; label: string; icon: any }> = [
  { id: "ALL", label: "Todo", icon: Inbox },
  { id: "UNREAD", label: "No leído", icon: EyeOff },
  { id: "UNASSIGNED", label: "Sin asignar", icon: UserX },
  { id: "UNANSWERED", label: "Sin responder", icon: Clock3 },
  { id: "CAP", label: "CAP incompleto", icon: Tag },
];

const STATUSES = [
  ["NEW", "Nuevo"],
  ["CONTACTED", "Contactado"],
  ["QUOTED", "Cotizado"],
  ["NEGOTIATION", "Negociación"],
  ["SCHEDULED", "Programado"],
  ["DELIVERED", "Entregado"],
  ["CLOSED", "Cerrado"],
  ["LOST", "Perdido"],
] as const;

function isUnanswered(lead: any) {
  if (!lead?.lastInboundAt) return false;
  if (!lead?.lastOutboundAt) return true;
  return new Date(lead.lastInboundAt).getTime() > new Date(lead.lastOutboundAt).getTime();
}

export default function InboxPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [current, setCurrent] = useState<any | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterId>("ALL");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadLeads = async () => {
    try {
      const res = await fetch("/api/admin/crm/leads", { cache: "no-store" });
      if (res.ok) setLeads(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    const res = await fetch(`/api/admin/crm/leads?leadId=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (res.ok) setCurrent(await res.json());
  };

  useEffect(() => {
    loadLeads();
    fetch("/api/admin/sales-users", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSellers)
      .catch(() => setSellers([]));

    const timer = window.setInterval(loadLeads, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(() => loadDetail(selected), 5000);
    return () => window.clearInterval(timer);
  }, [selected]);

  const counts = useMemo(() => ({
    ALL: leads.length,
    UNREAD: leads.filter((x) => Number(x.unreadCount || 0) > 0).length,
    UNASSIGNED: leads.filter((x) => !x.assignedSellerId).length,
    UNANSWERED: leads.filter(isUnanswered).length,
    CAP: leads.filter((x) => !x.capC || !x.capA || !x.capP).length,
  }), [leads]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter === "UNREAD" && Number(lead.unreadCount || 0) === 0) return false;
      if (filter === "UNASSIGNED" && lead.assignedSellerId) return false;
      if (filter === "UNANSWERED" && !isUnanswered(lead)) return false;
      if (filter === "CAP" && lead.capC && lead.capA && lead.capP) return false;
      if (!text) return true;
      return [lead.name, lead.phone, lead.whatsappId, lead.lastMessageText, lead.assignedSellerName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [leads, filter, query]);

  const openLead = async (lead: any) => {
    setSelected(lead.id);
    setSendError("");
    setCurrent(null);
    await fetch("/api/admin/crm/leads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, action: "mark-read" }),
    });
    await Promise.all([loadDetail(lead.id), loadLeads()]);
  };

  const updateLead = async (patch: any) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/crm/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, ...patch }),
      });
      if (res.ok) await Promise.all([loadDetail(current.id), loadLeads()]);
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!current || !text || busy) return;
    setBusy(true);
    setSendError("");
    try {
      const res = await fetch("/api/admin/crm/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: current.id, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error || "No se pudo enviar el mensaje");
        return;
      }
      setDraft("");
      await Promise.all([loadDetail(current.id), loadLeads()]);
    } catch {
      setSendError("No se pudo conectar con el servidor");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="-m-7 h-[calc(100vh-0px)] min-h-[680px] bg-white border-t border-hair flex overflow-hidden">
      <aside className="w-[205px] border-r border-hair bg-[#F8F9FA] shrink-0 flex flex-col">
        <div className="px-4 py-4 border-b border-hair">
          <div className="font-display font-bold text-base">Bandeja</div>
          <div className="text-[11px] text-muted mt-0.5">WhatsApp · Meta API</div>
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
        <div className="mt-auto p-3 border-t border-hair space-y-2">
          <button onClick={loadLeads} className="text-xs text-muted flex items-center gap-1.5 hover:text-slate-dark"><RefreshCcw size={12}/> Actualizar</button>
          <Link href="/admin/crm" className="text-xs font-semibold text-copper flex items-center gap-1 hover:underline">Ver pipeline <ChevronRight size={12}/></Link>
        </div>
      </aside>

      <section className="w-[390px] border-r border-hair shrink-0 flex flex-col bg-white">
        <div className="p-3 border-b border-hair">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nombre, teléfono o mensaje..." className="w-full border border-hair rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-copper"/>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading && <div className="p-8 text-center text-xs text-muted">Cargando conversaciones...</div>}
          {!loading && filtered.length === 0 && <div className="p-8 text-center text-xs text-muted">No hay conversaciones para este filtro.</div>}
          {filtered.map((lead) => {
            const active = selected === lead.id;
            const unread = Number(lead.unreadCount || 0);
            return (
              <button key={lead.id} onClick={() => openLead(lead)} className={`w-full text-left px-4 py-3.5 border-b border-hair hover:bg-paper/60 transition-colors ${active ? "bg-[#F2F5F7] border-l-2 border-l-copper" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#E9EDF1] flex items-center justify-center shrink-0 text-muted"><UserRound size={18}/></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`text-[13px] truncate ${unread ? "font-bold" : "font-semibold"}`}>{lead.name || lead.phone || "Cliente WhatsApp"}</div>
                      <div className="font-mono text-[9px] text-muted whitespace-nowrap">{lead.lastMessageAt ? timeAgo(lead.lastMessageAt) : ""}</div>
                    </div>
                    <div className={`text-[11px] truncate mt-1 ${unread ? "text-slate-dark font-medium" : "text-muted"}`}>{lead.lastMessageText || "Sin texto"}</div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[9px] rounded-full bg-paper px-2 py-1 text-muted">{lead.source === "META_TEST" ? "Prueba Meta" : "WhatsApp"}</span>
                      <span className="text-[9px] rounded-full bg-paper px-2 py-1 text-muted">{lead.status}</span>
                      {unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-copper text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <main className="flex-1 min-w-[430px] flex flex-col bg-[#FAFBFC]">
        {!current ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-muted">
            <MessageCircle size={42} strokeWidth={1.2} className="mb-3" />
            <div className="font-semibold text-slate-dark">Selecciona una conversación</div>
            <div className="text-xs mt-1 max-w-[380px]">Los mensajes que entren desde Meta aparecen aquí y quedan asociados al lead.</div>
          </div>
        ) : (
          <>
            <header className="h-[72px] px-5 border-b border-hair bg-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{current.name || current.phone || "Cliente WhatsApp"}</div>
                <div className="text-[11px] text-muted mt-0.5">{current.assignedSellerName ? `Asignado a ${current.assignedSellerName}` : "Sin vendedor asignado"} · {current.source === "META_TEST" ? "Prueba Meta" : "WhatsApp"}</div>
              </div>
              {current.phone && <a href={waLink(current.phone, "")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-hair bg-white rounded-lg px-3 py-2 text-xs font-semibold"><Phone size={13}/> Abrir WhatsApp</a>}
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3 max-w-[760px] mx-auto">
                {(current.messages || []).map((message: any) => {
                  const outbound = message.direction === "OUTBOUND";
                  return (
                    <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm border shadow-sm ${outbound ? "bg-[#FFF7F0] border-copper/20" : "bg-white border-hair"}`}>
                        <div className="whitespace-pre-wrap break-words">{message.text || `[${message.type}]`}</div>
                        <div className="text-[9px] text-muted mt-1.5 flex items-center gap-1.5">{message.sentAt ? new Date(message.sentAt).toLocaleString("es-CO") : ""}{outbound && <Check size={10}/>}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-hair bg-white p-4">
              {sendError && <div className="mb-2 text-xs text-alert bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-2"><AlertCircle size={14} className="shrink-0 mt-0.5"/><span>{sendError}</span></div>}
              {current.source === "META_TEST" ? (
                <div className="border border-dashed border-hair rounded-xl px-4 py-3 text-xs text-muted">Este lead viene del evento simulado de Meta. Para probar respuestas, usa una conversación real con el número de prueba.</div>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Escribe un mensaje..."
                    rows={2}
                    className="flex-1 resize-none border border-hair rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-copper"
                  />
                  <button onClick={sendMessage} disabled={busy || !draft.trim()} className="h-[48px] px-4 rounded-xl bg-copper text-white disabled:opacity-40 flex items-center gap-2 text-sm font-semibold"><Send size={16}/> Enviar</button>
                </div>
              )}
              <div className="text-[10px] text-muted mt-2">Pago en casa / contraentrega · respuesta por WhatsApp Cloud API</div>
            </div>
          </>
        )}
      </main>

      <aside className="w-[315px] border-l border-hair bg-white shrink-0 overflow-y-auto">
        {!current ? (
          <div className="h-full flex items-center justify-center text-xs text-muted p-6 text-center">La ficha comercial aparecerá aquí.</div>
        ) : (
          <div>
            <div className="p-5 border-b border-hair text-center">
              <div className="w-16 h-16 rounded-full bg-[#E9EDF1] mx-auto flex items-center justify-center text-muted"><UserRound size={28}/></div>
              <div className="font-semibold mt-3">{current.name || "Cliente WhatsApp"}</div>
              <div className="text-[11px] text-muted mt-1">{current.phone || current.whatsappId}</div>
            </div>
            <div className="p-5 space-y-5">
              <section>
                <div className="text-[11px] font-semibold mb-2">Estado comercial</div>
                <select disabled={busy} value={current.status || "NEW"} onChange={(e) => updateLead({ status: e.target.value })} className="w-full border border-hair rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-copper">
                  {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </section>

              <section>
                <div className="text-[11px] font-semibold mb-2">Responsable</div>
                <select disabled={busy} value={current.assignedSellerId || ""} onChange={(e) => { const seller = sellers.find((x) => x.id === e.target.value); updateLead({ assignedSellerId: seller?.id || "", assignedSellerName: seller?.name || "" }); }} className="w-full border border-hair rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-copper">
                  <option value="">Sin asignar</option>
                  {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
                </select>
              </section>

              <section>
                <div className="text-[11px] font-semibold mb-2">C · A · P</div>
                <div className="grid grid-cols-3 gap-2">
                  <CapButton label="C" active={Boolean(current.capC)} onClick={() => updateLead({ capC: !current.capC })}/>
                  <CapButton label="A" active={Boolean(current.capA)} onClick={() => updateLead({ capA: !current.capA })}/>
                  <CapButton label="P" active={Boolean(current.capP)} onClick={() => updateLead({ capP: !current.capP })}/>
                </div>
                <div className="text-[10px] text-muted mt-2">El lead debe completar las tres etiquetas antes de cerrar el proceso comercial.</div>
              </section>

              <section className="border-t border-hair pt-4 space-y-2 text-xs">
                <Info label="Canal" value="WhatsApp"/>
                <Info label="Origen" value={current.source === "META_TEST" ? "Prueba Meta" : current.source || "WhatsApp"}/>
                <Info label="Mensajes" value={String((current.messages || []).length)}/>
                <Info label="Último ingreso" value={current.lastInboundAt ? new Date(current.lastInboundAt).toLocaleString("es-CO") : "—"}/>
              </section>

              <Link href="/admin/crm" className="border border-hair rounded-lg p-3 flex items-center justify-between gap-2 hover:border-copper transition-colors text-xs font-semibold">Ir al pipeline <ChevronRight size={14}/></Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function CapButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`h-11 rounded-lg border text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${active ? "border-copper bg-copper/10 text-copper" : "border-hair bg-white text-muted"}`}>{active ? <Check size={14}/> : <Circle size={12}/>} {label}</button>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><span className="text-muted">{label}</span><span className="font-medium text-right">{value}</span></div>;
}
