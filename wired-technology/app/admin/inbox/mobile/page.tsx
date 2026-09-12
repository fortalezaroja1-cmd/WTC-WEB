"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock3,
  EyeOff,
  Inbox,
  Phone,
  RefreshCcw,
  Search,
  Send,
  Tag,
  UserRound,
  UserX,
} from "lucide-react";
import { timeAgo, waLink } from "@/lib/utils";

type FilterId = "ALL" | "UNREAD" | "UNASSIGNED" | "UNANSWERED" | "CALL" | "CAP";

const FILTERS: Array<{ id: FilterId; label: string; icon: any }> = [
  { id: "ALL", label: "Todo", icon: Inbox },
  { id: "UNREAD", label: "No leído", icon: EyeOff },
  { id: "UNASSIGNED", label: "Sin asignar", icon: UserX },
  { id: "UNANSWERED", label: "Sin responder", icon: Clock3 },
  { id: "CALL", label: "Llamadas", icon: Phone },
  { id: "CAP", label: "CAP", icon: Tag },
];

function isUnanswered(lead: any) {
  if (!lead?.lastInboundAt) return false;
  if (!lead?.lastOutboundAt) return true;
  return new Date(lead.lastInboundAt).getTime() > new Date(lead.lastOutboundAt).getTime();
}

export default function MobileInboxPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [current, setCurrent] = useState<any | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("ALL");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    CALL: leads.filter((x) => x.capLabel === "LLAMADA").length,
    CAP: leads.filter((x) => x.capPending !== false).length,
  }), [leads]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter === "UNREAD" && Number(lead.unreadCount || 0) === 0) return false;
      if (filter === "UNASSIGNED" && lead.assignedSellerId) return false;
      if (filter === "UNANSWERED" && !isUnanswered(lead)) return false;
      if (filter === "CALL" && lead.capLabel !== "LLAMADA") return false;
      if (filter === "CAP" && lead.capPending === false) return false;
      if (!text) return true;
      return [lead.name, lead.phone, lead.whatsappId, lead.lastMessageText, lead.assignedSellerName, lead.capLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [leads, filter, query]);

  const openLead = async (lead: any) => {
    setSelected(lead.id);
    setCurrent(null);
    setError("");
    await fetch("/api/admin/crm/leads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, action: "mark-read" }),
    }).catch(() => null);
    await Promise.all([loadDetail(lead.id), loadLeads()]);
  };

  const closeLead = () => {
    setSelected(null);
    setCurrent(null);
    setDraft("");
    setError("");
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!current || !text || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/crm/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: current.id, text }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "No se pudo enviar el mensaje");
      else {
        setDraft("");
        await Promise.all([loadDetail(current.id), loadLeads()]);
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setBusy(false);
    }
  };

  if (selected) {
    return (
      <div className="md:hidden -m-3 h-[calc(100dvh-56px)] bg-[#FAFBFC] flex flex-col overflow-hidden">
        <header className="h-16 shrink-0 bg-white border-b border-hair px-3 flex items-center gap-2">
          <button onClick={closeLead} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-paper" aria-label="Volver a conversaciones">
            <ArrowLeft size={20} />
          </button>
          <div className="w-9 h-9 rounded-full bg-[#E9EDF1] flex items-center justify-center text-muted shrink-0">
            <UserRound size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{current?.name || current?.phone || "Cliente WhatsApp"}</div>
            <div className="text-[10px] text-muted truncate">
              {current?.assignedSellerName ? current.assignedSellerName : "Sin vendedor asignado"}
              {current?.capPending !== false ? ` · CAP ${current?.capStep || "C"}` : ""}
            </div>
          </div>
          {current?.phone && (
            <a href={waLink(current.phone, "")} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-hair bg-white flex items-center justify-center shrink-0" aria-label="Abrir WhatsApp">
              <Phone size={16} />
            </a>
          )}
        </header>

        <div className="px-3 py-2 bg-white border-b border-hair flex gap-2 overflow-x-auto shrink-0">
          <span className="text-[10px] whitespace-nowrap rounded-full bg-paper px-2.5 py-1.5">{current?.status || "NEW"}</span>
          {current?.capLabel === "LLAMADA" && <span className="text-[10px] whitespace-nowrap rounded-full bg-copper/10 text-copper font-bold px-2.5 py-1.5">LLAMADA</span>}
          {current?.capPending !== false && <span className="text-[10px] whitespace-nowrap rounded-full bg-amber-50 text-copper font-bold px-2.5 py-1.5">CAP pendiente</span>}
          {current?.phone && <span className="text-[10px] whitespace-nowrap rounded-full bg-paper px-2.5 py-1.5">{current.phone}</span>}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 overscroll-contain">
          {!current && <div className="h-full flex items-center justify-center text-xs text-muted">Cargando conversación...</div>}
          <div className="space-y-2.5">
            {(current?.messages || []).map((message: any) => {
              const outbound = message.direction === "OUTBOUND";
              return (
                <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed border shadow-sm break-words ${outbound ? "bg-[#FFF7F0] border-copper/20 rounded-br-md" : "bg-white border-hair rounded-bl-md"}`}>
                    <div className="whitespace-pre-wrap break-words">{message.text || `[${message.type}]`}</div>
                    <div className="text-[9px] text-muted mt-1.5 flex items-center gap-1.5">
                      {message.sentAt ? new Date(message.sentAt).toLocaleString("es-CO", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : ""}
                      {outbound && <Check size={10} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 bg-white border-t border-hair p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {current?.capLabel === "LLAMADA" && <div className="mb-2 text-[10px] bg-copper/5 border border-copper/20 rounded-lg px-2.5 py-2">Este lead está en etapa LLAMADA.</div>}
          {error && <div className="mb-2 text-[11px] text-alert bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          {current?.source === "META_TEST" ? (
            <div className="border border-dashed border-hair rounded-xl px-4 py-3 text-xs text-muted">Lead de prueba Meta.</div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Escribe un mensaje..."
                className="flex-1 min-w-0 resize-none border border-hair rounded-2xl px-4 py-3 text-[14px] leading-5 focus:outline-none focus:border-copper max-h-28"
              />
              <button onClick={sendMessage} disabled={busy || !draft.trim()} className="w-12 h-12 rounded-full bg-copper text-white disabled:opacity-40 flex items-center justify-center shrink-0" aria-label="Enviar mensaje">
                <Send size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="md:hidden -m-3 h-[calc(100dvh-56px)] bg-white flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-hair shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl">Bandeja</h1>
            <div className="text-[11px] text-muted mt-0.5">WhatsApp · Meta API</div>
          </div>
          <button onClick={loadLeads} className="w-10 h-10 rounded-full border border-hair flex items-center justify-center" aria-label="Actualizar">
            <RefreshCcw size={16} />
          </button>
        </div>
        <div className="relative mt-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar conversación..." className="w-full border border-hair rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-copper" />
        </div>
      </div>

      <div className="px-3 py-2 border-b border-hair overflow-x-auto flex gap-2 shrink-0 bg-[#FAFBFC]">
        {FILTERS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setFilter(id)} className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] border ${filter === id ? "border-copper bg-copper/10 text-copper font-semibold" : "border-hair bg-white text-muted"}`}>
            <Icon size={13} /> {label}
            <span className="font-mono text-[9px]">{counts[id]}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {loading && <div className="p-10 text-center text-xs text-muted">Cargando conversaciones...</div>}
        {!loading && filtered.length === 0 && <div className="p-10 text-center text-xs text-muted">No hay conversaciones para este filtro.</div>}
        {filtered.map((lead) => {
          const unread = Number(lead.unreadCount || 0);
          const call = lead.capLabel === "LLAMADA";
          return (
            <button key={lead.id} onClick={() => openLead(lead)} className="w-full text-left px-4 py-4 border-b border-hair active:bg-paper/80">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${call ? "bg-copper/10 text-copper" : "bg-[#E9EDF1] text-muted"}`}>
                  {call ? <Phone size={18} /> : <UserRound size={19} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[14px] truncate ${unread ? "font-bold" : "font-semibold"}`}>{lead.name || lead.phone || "Cliente WhatsApp"}</div>
                    <div className="font-mono text-[9px] text-muted whitespace-nowrap">{lead.lastMessageAt ? timeAgo(lead.lastMessageAt) : ""}</div>
                  </div>
                  <div className={`text-[12px] truncate mt-1 ${unread ? "text-slate-dark font-medium" : "text-muted"}`}>{lead.lastMessageText || "Sin texto"}</div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {call && <span className="text-[9px] rounded-full bg-copper/10 px-2 py-1 text-copper font-bold">LLAMADA</span>}
                    {lead.capPending !== false && !call && <span className="text-[9px] rounded-full bg-amber-50 px-2 py-1 text-copper font-bold">CAP · {lead.capStep || "C"}</span>}
                    {!lead.assignedSellerId && <span className="text-[9px] rounded-full bg-paper px-2 py-1 text-muted">Sin asignar</span>}
                    {unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-copper text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
