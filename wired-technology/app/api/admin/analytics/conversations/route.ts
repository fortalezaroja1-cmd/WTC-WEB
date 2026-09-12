import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureCrmTables } from "@/lib/crm";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  assignedSellerId: string | null;
  assignedSellerName: string | null;
  capPending: boolean | null;
  capDecision: string | null;
  capLabel: string | null;
  capNextAt: Date | null;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  lastMessageAt: Date | null;
  createdAt: Date;
};

type MessageRow = {
  id: string;
  leadId: string;
  direction: string;
  type: string;
  text: string | null;
  sentAt: Date;
  senderType: string | null;
  senderUserId: string | null;
  senderUserName: string | null;
};

type SellerMetric = {
  sellerId: string;
  sellerName: string;
  leadsAssigned: number;
  leadsHandled: number;
  humanMessages: number;
  responsesMeasured: number;
  responseSeconds: number[];
  unanswered: number;
  capCompleted: number;
  closed: number;
  followupsOverdue: number;
};

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export async function GET(request: NextRequest) {
  try {
    await ensureCrmTables();

    const params = request.nextUrl.searchParams;
    const requestedDays = Number(params.get("days") || 30);
    const days = Number.isFinite(requestedDays) ? Math.min(365, Math.max(1, Math.round(requestedDays))) : 30;
    const sellerId = String(params.get("sellerId") || "ALL");
    const format = String(params.get("format") || "json").toLowerCase();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [users, leads, messages] = await Promise.all([
      prisma.adminUser.findMany({
        where: { active: true, role: { in: ["ADMIN", "SALES"] } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
      prisma.$queryRawUnsafe<LeadRow[]>(
        `SELECT "id", "name", "phone", "status", "source", "assignedSellerId", "assignedSellerName",
                "capPending", "capDecision", "capLabel", "capNextAt", "lastInboundAt", "lastOutboundAt",
                "lastMessageAt", "createdAt"
         FROM "Lead"
         WHERE COALESCE("lastMessageAt", "createdAt") >= $1
         ORDER BY COALESCE("lastMessageAt", "createdAt") DESC`,
        start,
      ),
      prisma.$queryRawUnsafe<MessageRow[]>(
        `SELECT "id", "leadId", "direction", "type", "text", "sentAt",
                "senderType", "senderUserId", "senderUserName"
         FROM "CrmMessage"
         WHERE "sentAt" >= $1
         ORDER BY "leadId" ASC, "sentAt" ASC, "createdAt" ASC`,
        start,
      ),
    ]);

    const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
    const messagesByLead = new Map<string, MessageRow[]>();
    for (const message of messages) {
      const bucket = messagesByLead.get(message.leadId) || [];
      bucket.push(message);
      messagesByLead.set(message.leadId, bucket);
    }

    const metrics = new Map<string, SellerMetric>();
    const ensureMetric = (id: string, name: string) => {
      if (!metrics.has(id)) {
        metrics.set(id, {
          sellerId: id,
          sellerName: name,
          leadsAssigned: 0,
          leadsHandled: 0,
          humanMessages: 0,
          responsesMeasured: 0,
          responseSeconds: [],
          unanswered: 0,
          capCompleted: 0,
          closed: 0,
          followupsOverdue: 0,
        });
      }
      return metrics.get(id)!;
    };

    for (const user of users) ensureMetric(user.id, user.name || user.email);

    const now = Date.now();
    for (const lead of leads) {
      if (!lead.assignedSellerId) continue;
      const metric = ensureMetric(lead.assignedSellerId, lead.assignedSellerName || "Vendedor");
      metric.leadsAssigned += 1;
      if (lead.lastInboundAt && (!lead.lastOutboundAt || new Date(lead.lastInboundAt).getTime() > new Date(lead.lastOutboundAt).getTime())) metric.unanswered += 1;
      if (lead.capPending === false) metric.capCompleted += 1;
      if (["CLOSED", "DELIVERED"].includes(String(lead.status || "").toUpperCase())) metric.closed += 1;
      if (lead.capNextAt && new Date(lead.capNextAt).getTime() < now && !["CLOSED", "DELIVERED", "LOST"].includes(String(lead.status || "").toUpperCase())) metric.followupsOverdue += 1;
    }

    const conversationRows: any[] = [];
    const exportRows: any[] = [];

    for (const lead of leads) {
      const thread = messagesByLead.get(lead.id) || [];
      let pendingInboundAt: Date | null = null;
      let lastInboundText = "";
      let firstResponseSeconds: number | null = null;
      let latestResponseSeconds: number | null = null;
      let inboundCount = 0;
      let outboundHumanCount = 0;
      const humanSellerIds = new Set<string>();

      for (const message of thread) {
        let responseSeconds: number | null = null;
        let sellerForMessageId: string | null = null;
        let sellerForMessageName: string | null = null;
        let attribution = "";

        if (message.direction === "INBOUND") {
          inboundCount += 1;
          if (!pendingInboundAt) pendingInboundAt = new Date(message.sentAt);
          lastInboundText = message.text || lastInboundText;
        } else {
          const explicitHuman = message.senderType === "HUMAN" && Boolean(message.senderUserId);
          const legacyHuman = message.senderType === "LEGACY" && Boolean(lead.assignedSellerId);

          if (explicitHuman) {
            sellerForMessageId = message.senderUserId;
            sellerForMessageName = message.senderUserName || "Vendedor";
            attribution = "exacta";
          } else if (legacyHuman) {
            sellerForMessageId = lead.assignedSellerId;
            sellerForMessageName = lead.assignedSellerName || "Vendedor";
            attribution = "inferida_histórica";
          }

          if (pendingInboundAt) {
            responseSeconds = Math.max(0, Math.round((new Date(message.sentAt).getTime() - pendingInboundAt.getTime()) / 1000));
            pendingInboundAt = null;
          }

          if (sellerForMessageId) {
            const metric = ensureMetric(sellerForMessageId, sellerForMessageName || "Vendedor");
            metric.humanMessages += 1;
            humanSellerIds.add(sellerForMessageId);
            outboundHumanCount += 1;
            if (responseSeconds != null) {
              metric.responsesMeasured += 1;
              metric.responseSeconds.push(responseSeconds);
              if (firstResponseSeconds == null) firstResponseSeconds = responseSeconds;
              latestResponseSeconds = responseSeconds;
            }
          }
        }

        exportRows.push({
          seller_id: sellerForMessageId || "",
          seller_name: sellerForMessageName || "",
          attribution,
          lead_id: lead.id,
          cliente: lead.name || lead.phone || "Cliente",
          telefono: lead.phone || "",
          estado: lead.status,
          cap: lead.capLabel || lead.capDecision || "",
          direccion: message.direction,
          tipo_remitente: message.direction === "INBOUND" ? "CLIENT" : (message.senderType || "AGENT_OR_SYSTEM"),
          fecha: new Date(message.sentAt).toISOString(),
          tiempo_respuesta_segundos: responseSeconds ?? "",
          mensaje: message.text || `[${message.type}]`,
        });
      }

      for (const id of humanSellerIds) ensureMetric(id, metrics.get(id)?.sellerName || "Vendedor").leadsHandled += 1;

      const primarySellerId = humanSellerIds.size === 1 ? [...humanSellerIds][0] : (lead.assignedSellerId || "");
      const primarySellerName = primarySellerId ? (metrics.get(primarySellerId)?.sellerName || lead.assignedSellerName || "Vendedor") : "Sin asignar";

      conversationRows.push({
        leadId: lead.id,
        customer: lead.name || lead.phone || "Cliente",
        phone: lead.phone || "",
        sellerId: primarySellerId,
        sellerName: primarySellerName,
        status: lead.status,
        capLabel: lead.capLabel || lead.capDecision || "—",
        inboundCount,
        outboundHumanCount,
        firstResponseSeconds,
        latestResponseSeconds,
        unanswered: Boolean(lead.lastInboundAt && (!lead.lastOutboundAt || new Date(lead.lastInboundAt).getTime() > new Date(lead.lastOutboundAt).getTime())),
        lastInboundText,
        lastMessageAt: lead.lastMessageAt,
      });
    }

    const sellerMetrics = [...metrics.values()].map((metric) => ({
      sellerId: metric.sellerId,
      sellerName: metric.sellerName,
      leadsAssigned: metric.leadsAssigned,
      leadsHandled: metric.leadsHandled,
      humanMessages: metric.humanMessages,
      responsesMeasured: metric.responsesMeasured,
      avgResponseSeconds: avg(metric.responseSeconds),
      medianResponseSeconds: median(metric.responseSeconds),
      unanswered: metric.unanswered,
      capCompleted: metric.capCompleted,
      capComplianceRate: metric.leadsAssigned ? metric.capCompleted / metric.leadsAssigned * 100 : 0,
      closed: metric.closed,
      conversionRate: metric.leadsAssigned ? metric.closed / metric.leadsAssigned * 100 : 0,
      followupsOverdue: metric.followupsOverdue,
    })).filter((metric) => sellerId === "ALL" || metric.sellerId === sellerId);

    const filteredConversations = conversationRows.filter((row) => sellerId === "ALL" || row.sellerId === sellerId);
    const filteredExports = exportRows.filter((row) => sellerId === "ALL" || row.seller_id === sellerId);

    if (format === "csv") {
      const headers = [
        "seller_id", "seller_name", "attribution", "lead_id", "cliente", "telefono", "estado", "cap",
        "direccion", "tipo_remitente", "fecha", "tiempo_respuesta_segundos", "mensaje",
      ];
      const body = [headers.map(csvCell).join(","), ...filteredExports.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
      return new NextResponse(`\uFEFF${body}`, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="wired-conversaciones-${days}d.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      periodDays: days,
      start: start.toISOString(),
      sellers: users.map((user) => ({ id: user.id, name: user.name || user.email, role: user.role })),
      metrics: sellerMetrics,
      conversations: filteredConversations,
      note: "Mensajes nuevos guardan atribución exacta por usuario. Mensajes históricos marcados LEGACY se atribuyen al vendedor actualmente asignado al lead.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[CONVERSATION_ANALYTICS]", error);
    return NextResponse.json({ error: "No se pudo calcular la analítica de conversaciones" }, { status: 500 });
  }
}
