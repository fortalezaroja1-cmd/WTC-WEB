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

type CapForm = {
  closeReady: boolean;
  shippingConfirmed: boolean;
  productConfirmed: boolean;
  preDispatchSent: boolean;
  agreementOpen: boolean;
  label: "COTIZADO" | "SEGUIMIENTO";
  nextStep: string;
  nextAt: string;
  sequence: "MESSAGE" | "CALL" | "LAST_MESSAGE";
};

const DEFAULT_CAP_FORM: CapForm = {
  closeReady: false,
  shippingConfirmed: false,
  productConfirmed: false,
  preDispatchSent: false,
  agreementOpen: false,
  label: "COTIZADO",
  nextStep: "",
  nextAt: "",
  sequence: "MESSAGE",
};

const FILTERS: Array<{ id: FilterId; label: string; icon: any }> = [
  { id: "ALL", label: "Todo", icon: Inbox },
  { id: "UNREAD", label: "No leído", icon: EyeOff },
  { id: "UNASSIGNED", label: "Sin asignar", icon: UserX },
  { id: "UNANSWERED", label: "Sin responder", icon: Clock3 },
  { id: "CAP", label: "CAP pendiente", icon: Tag },
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

const SEQUENCE_LABELS: Record<string, string> = {
  MESSAGE: "Mensaje",
  CALL: "Llamada",
  LAST_MESSAGE: "Último mensaje",
};

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
  const [updateError, setUpdateError] = useState("");
  const [capError, setCapError] = useState("");
  const [capForm, setCapForm] = useState<CapForm>(DEFAULT_CAP_FORM);
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

  useEffect(() => {
    setCapForm(DEFAULT_CAP_FORM);
    setCapError("");
    setUpdateError("");
  }, [current?.id, current?.capStep, current?.capCompletedAt]);

  const counts = useMemo(() => ({
    ALL: leads.length,
    UNREAD: leads.filter((x) => Number(x.unreadCount || 0) > 0).length,
    UNASSIGNED: leads.filter((x) => !x.assignedSellerId).length,
    UNANSWERED: leads.filter(isUnanswered).length,
    CAP: leads.filter((x) => x.capPending !== false).length,
  }), [leads]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter === "UNREAD" && Number(lead.unreadCount || 0) === 0) return false;
      if (filter === "UNASSIGNED" && lead.assignedSellerId) return false;
      if (filter === "UNANSWERED" && !isUnanswered(lead)) return false;
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
    setSendError("");
    setUpdateError("");
    setCapError("");
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
    setUpdateError("");
    try {
      const res = await fetch("/api/admin/crm/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUpdateError(data.error || "No se pudo actualizar el lead");
        return;
      }
      await Promise.all([loadDetail(current.id), loadLeads()]);
    } catch {
      setUpdateError("No se pudo conectar con el servidor");
    } finally {
      setBusy(false);
    }
  };

  const answerCap = async (payload: any) => {
    if (!current || busy) return;
    setBusy(true);
    setCapError("");
    try {
      const res = await fetch("/api/admin/crm/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, action: "cap-answer", ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCapError(data.error || "No se pudo completar CAP");
        return;
      }
      setCapForm(DEFAULT_CAP_FORM);
      await Promise.all([loadDetail(current.id), loadLeads()]);
    } catch {
      setCapError("No se pudo conectar con el servidor");
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
      setCapForm(DEFAULT_CAP_FORM);
      await Promise.all([loadDetail(current.id), loadLeads()]);
    } catch {
      setSendError("No se pudo conectar con el servidor");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="-m-7 h-screen min-h-[680px] bg-white border-t border-hair overflow-hidden grid grid-cols-[180px_minmax(260px,320px)_minmax(0,1fr)] xl:grid-cols-[190px_minmax(280px,340px)_minmax(0,1fr)_320px] 2xl:grid-cols-[205px_360px_minmax(0,1fr)_340px]">
      <aside className="min-w-0 border-r border-hair bg-[#F8F9FA] flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-hair shrink-0">
          <div className="font-display font-bold text-base">Bandeja</div>
          <div className="text-[11px] text-muted mt-0.5">WhatsApp · Meta API</div>
        </div>
        <div className="p-2.5 space-y-1 overflow-y-auto">
          {FILTERS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setFilter(id)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${filter === id ? "bg-white border border-hair shadow-sm font-semibold" : "hover:bg-white"}`}>
              <Icon size={15} className={filter === id ? "text-copper shrink-0" : "text-muted shrink-0"} />
              <span className="flex-1 truncate">{label}</span>
              <span className="font-mono text-[10px] text-muted shrink-0">{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto p-3 border-t border-hair shrink-0 space-y-2">
          <button onClick={loadLeads} className="text-xs text-muted flex items-center gap-1.5 hover:text-slate-dark"><RefreshCcw size={12}/> Actualizar</button>
          <Link href="/admin/crm" className="text-xs font-semibold text-copper flex items-center gap-1 hover:underline">Ver pipeline <ChevronRight size={12}/></Link>
        </div>
      </aside>

      <section className="min-w-0 border-r border-hair flex flex-col bg-white overflow-hidden">
        <div className="p-3 border-b border-hair shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nombre, teléfono o mensaje..." className="w-full min-w-0 border border-hair rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-copper"/>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {loading && <div className="p-8 text-center text-xs text-muted">Cargando conversaciones...</div>}
          {!loading && filtered.length === 0 && <div className="p-8 text-center text-xs text-muted">No hay conversaciones para este filtro.</div>}
          {filtered.map((lead) => {
            const active = selected === lead.id;
            const unread = Number(lead.unreadCount || 0);
            return (
              <button key={lead.id} onClick={() => openLead(lead)} className={`w-full text-left px-4 py-3.5 border-b border-hair hover:bg-paper/60 transition-colors ${active ? "bg-[#F2F5F7] border-l-2 border-l-copper" : ""}`}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#E9EDF1] flex items-center justify-center shrink-0 text-muted"><UserRound size={18}/></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className={`text-[13px] truncate min-w-0 ${unread ? "font-bold" : "font-semibold"}`}>{lead.name || lead.phone || "Cliente WhatsApp"}</div>
                      <div className="font-mono text-[9px] text-muted whitespace-nowrap shrink-0">{lead.lastMessageAt ? timeAgo(lead.lastMessageAt) : ""}</div>
                    </div>
                    <div className={`text-[11px] truncate mt-1 ${unread ? "text-slate-dark font-medium" : "text-muted"}`}>{lead.lastMessageText || "Sin texto"}</div>
                    <div className="flex items-center gap-1.5 mt-2 min-w-0 flex-wrap">
                      <span className="text-[9px] rounded-full bg-paper px-2 py-1 text-muted truncate max-w-[100px]">{lead.source === "META_TEST" ? "Prueba Meta" : "WhatsApp"}</span>
                      <span className="text-[9px] rounded-full bg-paper px-2 py-1 text-muted truncate">{lead.status}</span>
                      {lead.capPending !== false ? (
                        <span className="text-[9px] rounded-full bg-amber-50 px-2 py-1 text-copper font-bold">CAP · {lead.capStep || "C"}</span>
                      ) : lead.capDecision ? (
                        <span className="text-[9px] rounded-full bg-green-50 px-2 py-1 text-green font-bold">{lead.capDecision} · {lead.capLabel || "OK"}</span>
                      ) : null}
                      {unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-copper text-white text-[9px] font-bold flex items-center justify-center shrink-0">{unread}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <main className="min-w-0 flex flex-col bg-[#FAFBFC] overflow-hidden">
        {!current ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-muted min-w-0">
            <MessageCircle size={42} strokeWidth={1.2} className="mb-3" />
            <div className="font-semibold text-slate-dark">Selecciona una conversación</div>
            <div className="text-xs mt-1 max-w-[380px]">Los mensajes que entren desde Meta aparecen aquí y quedan asociados al lead.</div>
          </div>
        ) : (
          <>
            <header className="h-[72px] px-4 xl:px-5 border-b border-hair bg-white flex items-center justify-between gap-3 shrink-0 min-w-0">
              <div className="min-w-0">
                <div className="font-semibold truncate">{current.name || current.phone || "Cliente WhatsApp"}</div>
                <div className="text-[11px] text-muted mt-0.5 truncate">{current.assignedSellerName ? `Asignado a ${current.assignedSellerName}` : "Sin vendedor asignado"} · {current.source === "META_TEST" ? "Prueba Meta" : "WhatsApp"}</div>
              </div>
              {current.phone && <a href={waLink(current.phone, "")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-hair bg-white rounded-lg px-3 py-2 text-xs font-semibold shrink-0"><Phone size={13}/><span className="hidden 2xl:inline">Abrir WhatsApp</span></a>}
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 xl:p-6">
              <div className="space-y-3 max-w-[760px] mx-auto min-w-0">
                {(current.messages || []).map((message: any) => {
                  const outbound = message.direction === "OUTBOUND";
                  return (
                    <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm border shadow-sm break-words ${outbound ? "bg-[#FFF7F0] border-copper/20" : "bg-white border-hair"}`}>
                        <div className="whitespace-pre-wrap break-words">{message.text || `[${message.type}]`}</div>
                        <div className="text-[9px] text-muted mt-1.5 flex items-center gap-1.5">{message.sentAt ? new Date(message.sentAt).toLocaleString("es-CO") : ""}{outbound && <Check size={10}/>}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-hair bg-white p-3 xl:p-4 shrink-0">
              {current.capPending !== false && (
                <div className="mb-3 rounded-lg border border-copper/30 bg-amber-50 px-3 py-2 text-[11px] text-slate-dark">
                  <b>CAP obligatorio pendiente.</b> Después de responder, resuelve C → A → P desde la ficha comercial antes de avanzar el lead.
                </div>
              )}
              {sendError && <div className="mb-2 text-xs text-alert bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-2"><AlertCircle size={14} className="shrink-0 mt-0.5"/><span>{sendError}</span></div>}
              {current.source === "META_TEST" ? (
                <div className="border border-dashed border-hair rounded-xl px-4 py-3 text-xs text-muted">Este lead viene del evento simulado de Meta. Para probar respuestas, usa una conversación real con el número de prueba.</div>
              ) : (
                <div className="flex items-end gap-2 min-w-0">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Escribe un mensaje..." rows={2} className="flex-1 min-w-0 resize-none border border-hair rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-copper"/>
                  <button onClick={sendMessage} disabled={busy || !draft.trim()} className="h-[48px] px-3 xl:px-4 rounded-xl bg-copper text-white disabled:opacity-40 flex items-center gap-2 text-sm font-semibold shrink-0"><Send size={16}/><span className="hidden 2xl:inline">Enviar</span></button>
                </div>
              )}
              <div className="text-[10px] text-muted mt-2">Pago en casa / contraentrega · respuesta por WhatsApp Cloud API</div>
            </div>
          </>
        )}
      </main>

      <aside className="hidden xl:block min-w-0 border-l border-hair bg-white overflow-y-auto">
        {!current ? (
          <div className="h-full flex items-center justify-center text-xs text-muted p-5 text-center">La ficha comercial aparecerá aquí.</div>
        ) : (
          <div className="min-w-0">
            <div className="p-4 2xl:p-5 border-b border-hair text-center">
              <div className="w-16 h-16 2xl:w-20 2xl:h-20 rounded-full bg-[#E9EDF1] mx-auto flex items-center justify-center text-muted"><UserRound size={30}/></div>
              <div className="font-semibold mt-3 break-words">{current.name || "Cliente WhatsApp"}</div>
              <div className="text-[11px] text-muted mt-1 break-all">{current.phone || current.whatsappId}</div>
            </div>
            <div className="p-4 2xl:p-5 space-y-5 min-w-0">
              <section>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[11px] font-semibold">Estado comercial</div>
                  {current.capPending !== false && <span className="text-[9px] font-bold text-copper">BLOQUEADO POR CAP</span>}
                </div>
                <select disabled={busy || current.capPending !== false} value={current.status || "NEW"} onChange={(e) => updateLead({ status: e.target.value })} className="w-full min-w-0 border border-hair rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-copper disabled:bg-paper disabled:text-muted">
                  {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {current.capPending !== false && <div className="text-[10px] text-muted mt-1.5">Completa la decisión CAP para cambiar de etapa.</div>}
                {updateError && <div className="text-[10px] text-alert mt-1.5">{updateError}</div>}
              </section>

              <section>
                <div className="text-[11px] font-semibold mb-2">Responsable</div>
                <select disabled={busy} value={current.assignedSellerId || ""} onChange={(e) => { const seller = sellers.find((x) => x.id === e.target.value); updateLead({ assignedSellerId: seller?.id || "", assignedSellerName: seller?.name || "" }); }} className="w-full min-w-0 border border-hair rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-copper">
                  <option value="">Sin asignar</option>
                  {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
                </select>
              </section>

              <section className={`rounded-xl border p-3 ${current.capPending !== false ? "border-copper/35 bg-[#FFFBF6]" : "border-green/25 bg-green-50/40"}`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="text-[11px] font-bold">MÉTODO CAP · OBLIGATORIO</div>
                    <div className="text-[9px] text-muted mt-0.5">Si no resolviste C, A o P, la conversación no terminó.</div>
                  </div>
                  {current.capPending === false && <Check size={16} className="text-green shrink-0"/>}
                </div>

                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <CapStep label="C" caption="Cerrar" done={Boolean(current.capC)} active={current.capPending !== false && (current.capStep || "C") === "C"} selected={current.capDecision === "C"}/>
                  <CapStep label="A" caption="Acordar" done={Boolean(current.capA)} active={current.capPending !== false && current.capStep === "A"} selected={current.capDecision === "A"}/>
                  <CapStep label="P" caption="Planear" done={Boolean(current.capP)} active={current.capPending !== false && current.capStep === "P"} selected={current.capDecision === "P"}/>
                </div>

                {capError && <div className="mb-3 text-[10px] text-alert bg-red-50 border border-red-100 rounded-lg px-2.5 py-2">{capError}</div>}

                {current.capPending !== false && (current.capStep || "C") === "C" && (
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-bold">C · ¿Puedo CERRAR?</div>
                      <div className="text-[10px] text-muted mt-1">Si el cliente está listo, verifica todo antes de marcar el cierre.</div>
                    </div>
                    {!capForm.agreementOpen ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button disabled={busy} onClick={() => setCapForm((x) => ({ ...x, agreementOpen: true }))} className="rounded-lg bg-copper text-white px-3 py-2.5 text-xs font-semibold">Sí, puedo cerrar</button>
                        <button disabled={busy} onClick={() => answerCap({ step: "C", answer: "NO" })} className="rounded-lg border border-hair bg-white px-3 py-2.5 text-xs font-semibold">No todavía</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <CheckRow checked={capForm.closeReady} onChange={(v) => setCapForm((x) => ({ ...x, closeReady: v }))} text="Pedido confirmado con el cliente"/>
                        <CheckRow checked={capForm.shippingConfirmed} onChange={(v) => setCapForm((x) => ({ ...x, shippingConfirmed: v }))} text="Datos de envío confirmados"/>
                        <CheckRow checked={capForm.productConfirmed} onChange={(v) => setCapForm((x) => ({ ...x, productConfirmed: v }))} text="Producto, color y cantidad confirmados"/>
                        <CheckRow checked={capForm.preDispatchSent} onChange={(v) => setCapForm((x) => ({ ...x, preDispatchSent: v }))} text="Verificación pre-despacho enviada"/>
                        <button
                          disabled={busy || !capForm.closeReady || !capForm.shippingConfirmed || !capForm.productConfirmed || !capForm.preDispatchSent}
                          onClick={() => answerCap({ step: "C", answer: "YES", closeReady: capForm.closeReady, shippingConfirmed: capForm.shippingConfirmed, productConfirmed: capForm.productConfirmed, preDispatchSent: capForm.preDispatchSent })}
                          className="w-full rounded-lg bg-copper text-white px-3 py-2.5 text-xs font-semibold disabled:opacity-40"
                        >
                          Completar C · POR-CERRAR
                        </button>
                        <button onClick={() => setCapForm((x) => ({ ...x, agreementOpen: false }))} className="w-full text-[10px] text-muted">Volver</button>
                      </div>
                    )}
                  </div>
                )}

                {current.capPending !== false && current.capStep === "A" && (
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-bold">A · ¿Puedo ACORDAR?</div>
                      <div className="text-[10px] text-muted mt-1">Debe quedar un siguiente paso concreto con fecha.</div>
                    </div>
                    {!capForm.agreementOpen ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button disabled={busy} onClick={() => setCapForm((x) => ({ ...x, agreementOpen: true }))} className="rounded-lg bg-copper text-white px-3 py-2.5 text-xs font-semibold">Sí, acordar</button>
                        <button disabled={busy} onClick={() => answerCap({ step: "A", answer: "NO" })} className="rounded-lg border border-hair bg-white px-3 py-2.5 text-xs font-semibold">No se comprometió</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <select value={capForm.label} onChange={(e) => setCapForm((x) => ({ ...x, label: e.target.value as CapForm["label"] }))} className="w-full border border-hair rounded-lg px-2.5 py-2 text-xs bg-white">
                          <option value="COTIZADO">COTIZADO</option>
                          <option value="SEGUIMIENTO">SEGUIMIENTO</option>
                        </select>
                        <input value={capForm.nextStep} onChange={(e) => setCapForm((x) => ({ ...x, nextStep: e.target.value }))} placeholder="Siguiente paso concreto" className="w-full border border-hair rounded-lg px-2.5 py-2 text-xs bg-white"/>
                        <input type="datetime-local" value={capForm.nextAt} onChange={(e) => setCapForm((x) => ({ ...x, nextAt: e.target.value }))} className="w-full border border-hair rounded-lg px-2.5 py-2 text-xs bg-white"/>
                        <button disabled={busy || !capForm.nextStep.trim() || !capForm.nextAt} onClick={() => answerCap({ step: "A", answer: "YES", label: capForm.label, nextStep: capForm.nextStep, nextAt: capForm.nextAt })} className="w-full rounded-lg bg-copper text-white px-3 py-2.5 text-xs font-semibold disabled:opacity-40">Registrar acuerdo</button>
                        <button onClick={() => setCapForm((x) => ({ ...x, agreementOpen: false }))} className="w-full text-[10px] text-muted">Volver</button>
                      </div>
                    )}
                  </div>
                )}

                {current.capPending !== false && current.capStep === "P" && (
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-bold">P · PLANEAR</div>
                      <div className="text-[10px] text-muted mt-1">Sin compromiso: mensaje → llamada → último mensaje.</div>
                    </div>
                    <select value={capForm.sequence} onChange={(e) => setCapForm((x) => ({ ...x, sequence: e.target.value as CapForm["sequence"] }))} className="w-full border border-hair rounded-lg px-2.5 py-2 text-xs bg-white">
                      <option value="MESSAGE">1. Mensaje</option>
                      <option value="CALL">2. Llamada</option>
                      <option value="LAST_MESSAGE">3. Último mensaje</option>
                    </select>
                    <input value={capForm.nextStep} onChange={(e) => setCapForm((x) => ({ ...x, nextStep: e.target.value }))} placeholder="Qué vas a hacer en el seguimiento" className="w-full border border-hair rounded-lg px-2.5 py-2 text-xs bg-white"/>
                    <input type="datetime-local" value={capForm.nextAt} onChange={(e) => setCapForm((x) => ({ ...x, nextAt: e.target.value }))} className="w-full border border-hair rounded-lg px-2.5 py-2 text-xs bg-white"/>
                    <button disabled={busy || !capForm.nextAt} onClick={() => answerCap({ step: "P", answer: "YES", sequence: capForm.sequence, nextStep: capForm.nextStep || `Seguimiento por ${SEQUENCE_LABELS[capForm.sequence].toLowerCase()}`, nextAt: capForm.nextAt })} className="w-full rounded-lg bg-copper text-white px-3 py-2.5 text-xs font-semibold disabled:opacity-40">Planear seguimiento</button>
                  </div>
                )}

                {current.capPending === false && (
                  <div className="rounded-lg border border-green/20 bg-white p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-green"><Check size={14}/> Gestión CAP completada por {current.capDecision === "C" ? "CERRAR" : current.capDecision === "A" ? "ACORDAR" : current.capDecision === "P" ? "PLANEAR" : "método anterior"}</div>
                    {current.capLabel && <div className="text-[10px] mt-2"><b>Etiqueta:</b> {current.capLabel}</div>}
                    {current.capNextStep && <div className="text-[10px] mt-1"><b>Próximo paso:</b> {current.capNextStep}</div>}
                    {current.capNextAt && <div className="text-[10px] mt-1"><b>Fecha:</b> {new Date(current.capNextAt).toLocaleString("es-CO")}</div>}
                    {current.capSequence && <div className="text-[10px] mt-1"><b>Secuencia:</b> {SEQUENCE_LABELS[current.capSequence] || current.capSequence}</div>}
                  </div>
                )}
              </section>

              <section className="border-t border-hair pt-4 space-y-2 text-xs">
                <Info label="Canal" value="WhatsApp"/>
                <Info label="Origen" value={current.source === "META_TEST" ? "Prueba Meta" : current.source || "WhatsApp"}/>
                <Info label="Mensajes" value={String((current.messages || []).length)}/>
                <Info label="Último ingreso" value={current.lastInboundAt ? new Date(current.lastInboundAt).toLocaleString("es-CO") : "—"}/>
              </section>

              {(current.activities || []).length > 0 && (
                <section className="border-t border-hair pt-4">
                  <div className="text-[11px] font-semibold mb-2">Historial CAP</div>
                  <div className="space-y-2">
                    {(current.activities || []).slice(0, 4).map((activity: any) => (
                      <div key={activity.id} className="rounded-lg bg-paper px-2.5 py-2">
                        <div className="text-[10px] font-medium break-words">{activity.text}</div>
                        <div className="text-[9px] text-muted mt-1">{new Date(activity.createdAt).toLocaleString("es-CO")}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <Link href="/admin/crm" className="border border-hair rounded-lg p-3 flex items-center justify-between gap-2 hover:border-copper transition-colors text-xs font-semibold">Ir al pipeline <ChevronRight size={14}/></Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function CapStep({ label, caption, done, active, selected }: { label: string; caption: string; done: boolean; active: boolean; selected: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-2 text-center ${selected ? "border-green bg-green-50" : active ? "border-copper bg-copper/10" : done ? "border-hair bg-white" : "border-hair bg-white opacity-60"}`}>
      <div className={`text-sm font-bold ${selected ? "text-green" : active ? "text-copper" : "text-slate-dark"}`}>{done || selected ? <span className="inline-flex items-center gap-1"><Check size={12}/>{label}</span> : label}</div>
      <div className="text-[8px] text-muted mt-0.5">{caption}</div>
    </div>
  );
}

function CheckRow({ checked, onChange, text }: { checked: boolean; onChange: (value: boolean) => void; text: string }) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-hair bg-white px-2.5 py-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5"/>
      <span className="text-[10px] leading-4">{text}</span>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><span className="text-muted">{label}</span><span className="font-medium text-right break-words min-w-0">{value}</span></div>;
}