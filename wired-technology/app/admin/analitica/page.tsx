"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Download, MessageSquareText, RefreshCcw, UserRoundCheck } from "lucide-react";
import { formatCOP } from "@/lib/utils";

type SellerMetric = {
  sellerId: string;
  sellerName: string;
  leadsAssigned: number;
  leadsHandled: number;
  humanMessages: number;
  responsesMeasured: number;
  avgResponseSeconds: number | null;
  medianResponseSeconds: number | null;
  unanswered: number;
  capCompleted: number;
  capComplianceRate: number;
  closed: number;
  conversionRate: number;
  followupsOverdue: number;
};

type Conversation = {
  leadId: string;
  customer: string;
  phone: string;
  sellerId: string;
  sellerName: string;
  status: string;
  capLabel: string;
  inboundCount: number;
  outboundHumanCount: number;
  firstResponseSeconds: number | null;
  latestResponseSeconds: number | null;
  unanswered: boolean;
  lastInboundText: string;
  lastMessageAt: string | null;
};

type ConversationAnalytics = {
  sellers: Array<{ id: string; name: string; role: string }>;
  metrics: SellerMetric[];
  conversations: Conversation[];
  note?: string;
};

function humanTime(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

export default function AnaliticaPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [conversationData, setConversationData] = useState<ConversationAnalytics>({ sellers: [], metrics: [], conversations: [] });
  const [days, setDays] = useState("30");
  const [sellerId, setSellerId] = useState("ALL");
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [responseError, setResponseError] = useState("");

  useEffect(() => {
    fetch("/api/admin/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setOrders(Array.isArray(d) ? d : []));
  }, []);

  const loadResponses = async () => {
    setLoadingResponses(true);
    setResponseError("");
    try {
      const query = new URLSearchParams({ days, sellerId });
      const res = await fetch(`/api/admin/analytics/conversations?${query.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la analítica de conversaciones");
      setConversationData(data);
    } catch (error: any) {
      setResponseError(error?.message || "No se pudo cargar la analítica de conversaciones");
    } finally {
      setLoadingResponses(false);
    }
  };

  useEffect(() => {
    loadResponses();
  }, [days, sellerId]);

  const data = useMemo(() => {
    const total = orders.length;
    const delivered = orders.filter((o) => o.shipStatus === "DELIVERED");
    const closed = delivered.reduce((s, o) => s + Number(o.total || 0), 0);
    const avg = delivered.length ? closed / delivered.length : 0;
    const bySeller: Record<string, { count: number; value: number }> = {};
    const byOrigin: Record<string, { count: number; value: number }> = {};
    const byProduct: Record<string, { qty: number; value: number }> = {};

    for (const o of orders) {
      const seller = o.workflow?.assignedSellerName || "Sin asignar";
      bySeller[seller] ||= { count: 0, value: 0 };
      bySeller[seller].count++;
      bySeller[seller].value += Number(o.total || 0);

      const origin = o.workflow?.origin || "Web";
      byOrigin[origin] ||= { count: 0, value: 0 };
      byOrigin[origin].count++;
      byOrigin[origin].value += Number(o.total || 0);

      for (const it of o.items || []) {
        byProduct[it.name] ||= { qty: 0, value: 0 };
        byProduct[it.name].qty += Number(it.qty || 0);
        byProduct[it.name].value += Number(it.total || 0);
      }
    }

    return {
      total,
      delivered: delivered.length,
      closed,
      avg,
      rate: total ? (delivered.length / total) * 100 : 0,
      bySeller,
      byOrigin,
      byProduct,
    };
  }, [orders]);

  const sellers = Object.entries(data.bySeller).sort((a, b) => b[1].value - a[1].value);
  const origins = Object.entries(data.byOrigin).sort((a, b) => b[1].count - a[1].count);
  const products = Object.entries(data.byProduct).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);
  const maxSeller = Math.max(1, ...sellers.map((x) => x[1].value));

  const responseSummary = useMemo(() => {
    const metrics = conversationData.metrics || [];
    const totalResponses = metrics.reduce((sum, item) => sum + Number(item.responsesMeasured || 0), 0);
    const weightedResponse = metrics.reduce((sum, item) => sum + Number(item.avgResponseSeconds || 0) * Number(item.responsesMeasured || 0), 0);
    const assigned = metrics.reduce((sum, item) => sum + Number(item.leadsAssigned || 0), 0);
    const capDone = metrics.reduce((sum, item) => sum + Number(item.capCompleted || 0), 0);
    const closed = metrics.reduce((sum, item) => sum + Number(item.closed || 0), 0);
    return {
      avgResponse: totalResponses ? weightedResponse / totalResponses : null,
      unanswered: metrics.reduce((sum, item) => sum + Number(item.unanswered || 0), 0),
      handled: metrics.reduce((sum, item) => sum + Number(item.leadsHandled || 0), 0),
      humanMessages: metrics.reduce((sum, item) => sum + Number(item.humanMessages || 0), 0),
      capRate: assigned ? capDone / assigned * 100 : 0,
      conversion: assigned ? closed / assigned * 100 : 0,
    };
  }, [conversationData]);

  const downloadQuery = new URLSearchParams({ days, sellerId, format: "csv" }).toString();

  return (
    <div className="max-w-[1280px]">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold">Analítica</h1>
        <p className="text-sm text-muted mt-1">Ventas, conversión y comportamiento real de respuesta del equipo comercial.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <Metric label="Pedidos" value={String(data.total)} />
        <Metric label="Entregados" value={String(data.delivered)} />
        <Metric label="Tasa de cierre" value={`${data.rate.toFixed(1)}%`} />
        <Metric label="Ticket promedio" value={formatCOP(data.avg)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-8">
        <section className="bg-white border border-hair rounded-xl p-5">
          <h2 className="font-semibold mb-4">Ventas por vendedor</h2>
          {sellers.length === 0 ? <Empty /> : (
            <div className="space-y-4">
              {sellers.map(([name, value]) => (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1 gap-3">
                    <span className="font-semibold truncate">{name}</span>
                    <span className="whitespace-nowrap">{formatCOP(value.value)} · {value.count} pedidos</span>
                  </div>
                  <div className="h-2 bg-paper rounded-full overflow-hidden">
                    <div className="h-full bg-copper rounded-full" style={{ width: `${Math.max(4, value.value / maxSeller * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-hair rounded-xl p-5">
          <h2 className="font-semibold mb-4">Origen de oportunidades</h2>
          {origins.length === 0 ? <Empty /> : (
            <div className="space-y-3">
              {origins.map(([name, value]) => (
                <div key={name} className="flex items-center justify-between border-b border-hair pb-3 gap-3">
                  <div>
                    <div className="text-sm font-semibold">{name}</div>
                    <div className="text-[10px] text-muted">{value.count} pedidos</div>
                  </div>
                  <div className="font-display font-bold text-sm whitespace-nowrap">{formatCOP(value.value)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-hair rounded-xl p-5 xl:col-span-2">
          <h2 className="font-semibold mb-4">Productos más pedidos</h2>
          {products.length === 0 ? <Empty /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              {products.map(([name, value], index) => (
                <div key={name} className="flex items-center justify-between border-b border-hair py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[10px] text-muted">#{index + 1}</span>
                    <span className="text-sm font-medium truncate">{name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{value.qty} und.</div>
                    <div className="text-[10px] text-muted">{formatCOP(value.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="border-t border-hair pt-7">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquareText size={20} className="text-copper" />
              <h2 className="font-display text-xl font-bold">Comportamiento de respuesta</h2>
            </div>
            <p className="text-sm text-muted mt-1">Mide velocidad, conversaciones atendidas, pendientes, CAP y conversión por vendedor.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select value={days} onChange={(e) => setDays(e.target.value)} className="bg-white border border-hair rounded-lg px-3 py-2.5 text-sm">
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="180">Últimos 180 días</option>
              <option value="365">Últimos 365 días</option>
            </select>
            <select value={sellerId} onChange={(e) => setSellerId(e.target.value)} className="bg-white border border-hair rounded-lg px-3 py-2.5 text-sm min-w-[190px]">
              <option value="ALL">Todos los vendedores</option>
              {(conversationData.sellers || []).map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
            </select>
            <button onClick={loadResponses} className="inline-flex items-center justify-center gap-2 bg-white border border-hair rounded-lg px-3 py-2.5 text-sm font-semibold hover:border-copper">
              <RefreshCcw size={15} /> Actualizar
            </button>
            <a href={`/api/admin/analytics/conversations?${downloadQuery}`} className="inline-flex items-center justify-center gap-2 bg-graphite text-white rounded-lg px-3 py-2.5 text-sm font-semibold">
              <Download size={15} /> Descargar CSV
            </a>
          </div>
        </div>

        {responseError && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 text-alert px-4 py-3 text-sm">{responseError}</div>}

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
          <ResponseMetric icon={Clock3} label="Respuesta promedio" value={loadingResponses ? "…" : humanTime(responseSummary.avgResponse)} />
          <ResponseMetric icon={MessageSquareText} label="Mensajes humanos" value={loadingResponses ? "…" : String(responseSummary.humanMessages)} />
          <ResponseMetric icon={UserRoundCheck} label="Conversaciones atendidas" value={loadingResponses ? "…" : String(responseSummary.handled)} />
          <ResponseMetric icon={Clock3} label="Sin responder" value={loadingResponses ? "…" : String(responseSummary.unanswered)} warning={responseSummary.unanswered > 0} />
          <ResponseMetric icon={UserRoundCheck} label="Cumplimiento CAP" value={loadingResponses ? "…" : `${responseSummary.capRate.toFixed(1)}%`} />
        </div>

        <div className="bg-white border border-hair rounded-xl overflow-hidden mb-5">
          <div className="px-4 sm:px-5 py-4 border-b border-hair">
            <div className="font-semibold">Resumen por vendedor</div>
            <div className="text-[11px] text-muted mt-0.5">Los mensajes nuevos se atribuyen al usuario que realmente los envió.</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-xs">
              <thead className="bg-[#F8F9FA] text-muted">
                <tr>
                  <Th>Vendedor</Th><Th>Leads asignados</Th><Th>Atendidos</Th><Th>Mensajes</Th><Th>Resp. promedio</Th><Th>Mediana</Th><Th>Sin responder</Th><Th>CAP</Th><Th>Conversión</Th><Th>Seguimientos vencidos</Th>
                </tr>
              </thead>
              <tbody>
                {conversationData.metrics.length === 0 && !loadingResponses ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted">Todavía no hay suficiente actividad humana para medir.</td></tr>
                ) : conversationData.metrics.map((metric) => (
                  <tr key={metric.sellerId} className="border-t border-hair">
                    <Td><span className="font-semibold">{metric.sellerName}</span></Td>
                    <Td>{metric.leadsAssigned}</Td>
                    <Td>{metric.leadsHandled}</Td>
                    <Td>{metric.humanMessages}</Td>
                    <Td>{humanTime(metric.avgResponseSeconds)}</Td>
                    <Td>{humanTime(metric.medianResponseSeconds)}</Td>
                    <Td><span className={metric.unanswered ? "text-alert font-semibold" : ""}>{metric.unanswered}</span></Td>
                    <Td>{metric.capComplianceRate.toFixed(1)}%</Td>
                    <Td>{metric.conversionRate.toFixed(1)}%</Td>
                    <Td><span className={metric.followupsOverdue ? "text-alert font-semibold" : ""}>{metric.followupsOverdue}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-hair rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-hair flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Conversaciones para revisión</div>
              <div className="text-[11px] text-muted mt-0.5">Úsalas para detectar demoras, mensajes sin respuesta y fallas de seguimiento.</div>
            </div>
            <div className="text-[11px] text-muted">{conversationData.conversations.length} conversaciones</div>
          </div>
          <div className="divide-y divide-hair">
            {conversationData.conversations.slice(0, 30).map((conversation) => (
              <div key={conversation.leadId} className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[1.1fr_.8fr_.55fr_2fr] gap-3 lg:gap-5 items-start">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{conversation.customer}</div>
                  <div className="text-[10px] text-muted mt-1 truncate">{conversation.phone || "Sin teléfono"} · {conversation.sellerName}</div>
                </div>
                <div className="text-xs">
                  <div><span className="text-muted">Primera respuesta:</span> <b>{humanTime(conversation.firstResponseSeconds)}</b></div>
                  <div className="mt-1"><span className="text-muted">Mensajes:</span> {conversation.inboundCount} cliente / {conversation.outboundHumanCount} vendedor</div>
                </div>
                <div className="text-xs">
                  <div className={conversation.unanswered ? "text-alert font-bold" : "font-semibold"}>{conversation.unanswered ? "Sin responder" : conversation.status}</div>
                  <div className="text-[10px] text-muted mt-1">CAP: {conversation.capLabel}</div>
                </div>
                <div className="min-w-0 text-xs text-muted leading-relaxed line-clamp-2">{conversation.lastInboundText || "Sin mensaje de cliente en el periodo."}</div>
              </div>
            ))}
            {conversationData.conversations.length === 0 && !loadingResponses && <div className="p-8 text-center text-sm text-muted">No hay conversaciones para el filtro seleccionado.</div>}
          </div>
        </div>

        {conversationData.note && <div className="text-[10px] text-muted mt-3">{conversationData.note}</div>}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-white border border-hair rounded-xl p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div><div className="font-display text-2xl font-bold mt-2">{value}</div></div>;
}

function ResponseMetric({ icon: Icon, label, value, warning = false }: { icon: any; label: string; value: string; warning?: boolean }) {
  return <div className="bg-white border border-hair rounded-xl p-4"><div className="flex items-center gap-2 text-muted"><Icon size={14} /><div className="font-mono text-[9px] uppercase tracking-wider">{label}</div></div><div className={`font-display text-xl sm:text-2xl font-bold mt-2 ${warning ? "text-alert" : ""}`}>{value}</div></div>;
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3 whitespace-nowrap">{children}</td>; }
function Empty() { return <div className="text-sm text-muted py-8 text-center">Todavía no hay datos suficientes.</div>; }
