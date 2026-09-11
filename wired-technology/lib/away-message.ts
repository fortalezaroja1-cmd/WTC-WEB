import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { saveOutboundWhatsAppMessage } from "@/lib/crm";

type AwayMessageConfig = {
  enabled: boolean;
  message: string;
  selfServiceUrl: string;
  activeDays: number[];
  cooldownHours: number;
  timezone: string;
};

const DEFAULT_MESSAGE =
  "En este momento estamos fuera de horario. Puedes armar tu pedido directamente en nuestra página y dejar tus datos. El equipo lo retoma al iniciar la jornada. Tenemos pago en casa / contraentrega.";

const DEFAULT_CONFIG: AwayMessageConfig = {
  enabled: true,
  message: DEFAULT_MESSAGE,
  selfServiceUrl: "",
  activeDays: [1, 2, 3, 4, 5, 6],
  cooldownHours: 8,
  timezone: "America/Bogota",
};

function normalizeUrl(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getDefaultSelfServiceUrl() {
  return normalizeUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      ""
  );
}

function parseAwayConfig(raw: string | null | undefined): AwayMessageConfig {
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      enabled: parsed?.enabled !== false,
      message: String(parsed?.message || DEFAULT_MESSAGE).trim(),
      selfServiceUrl: String(parsed?.selfServiceUrl || "").trim(),
      activeDays: Array.isArray(parsed?.activeDays)
        ? parsed.activeDays.map(Number).filter((day: number) => day >= 0 && day <= 6)
        : DEFAULT_CONFIG.activeDays,
      cooldownHours: Math.max(1, Math.min(72, Number(parsed?.cooldownHours) || DEFAULT_CONFIG.cooldownHours)),
      timezone: String(parsed?.timezone || DEFAULT_CONFIG.timezone),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function parseTime(value: string, fallback: string) {
  const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return parseTime(fallback, "08:00");
  return Math.min(23, Number(match[1])) * 60 + Math.min(59, Number(match[2]));
}

function getLocalClock(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  const weekday = get("weekday");
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: dayMap[weekday] ?? 0,
    minutes: Number(get("hour") || 0) * 60 + Number(get("minute") || 0),
  };
}

function isOutsideBusinessHours(config: AwayMessageConfig, workStart: string, workEnd: string) {
  const clock = getLocalClock(config.timezone);
  if (!config.activeDays.includes(clock.day)) return true;

  const start = parseTime(workStart, "08:00");
  const end = parseTime(workEnd, "18:00");
  if (start === end) return false;

  const isOpen = start < end
    ? clock.minutes >= start && clock.minutes < end
    : clock.minutes >= start || clock.minutes < end;

  return !isOpen;
}

async function loadConfig() {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ["awayMessageConfig", "workStart", "workEnd"] } },
  });
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    config: parseAwayConfig(settings.awayMessageConfig),
    workStart: settings.workStart || "08:00",
    workEnd: settings.workEnd || "18:00",
  };
}

async function wasRecentlySent(leadId: string, cooldownHours: number) {
  const threshold = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "CrmActivity" WHERE "leadId"=$1 AND "type"='AWAY_AUTO_REPLY' AND "createdAt">=$2 ORDER BY "createdAt" DESC LIMIT 1`,
    leadId,
    threshold
  );
  return rows.length > 0;
}

async function sendWhatsAppAwayMessage(input: {
  leadId: string;
  whatsappId: string;
  phoneNumberId: string;
  text: string;
}) {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("META_WHATSAPP_ACCESS_TOKEN no configurado");

  const graphVersion = process.env.META_GRAPH_VERSION || "v26.0";
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${input.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.whatsappId,
      type: "text",
      text: { preview_url: true, body: input.text.slice(0, 4096) },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "Meta rechazó el mensaje de ausencia");

  const metaMessageId = payload?.messages?.[0]?.id;
  if (!metaMessageId) throw new Error("Meta no devolvió ID para el mensaje de ausencia");

  await saveOutboundWhatsAppMessage({
    leadId: input.leadId,
    metaMessageId: String(metaMessageId),
    text: input.text,
    payload: { ...payload, kind: "away_auto_reply" },
  });
}

export async function maybeHandleAwayMessage(input: {
  leadId: string;
  whatsappId: string;
  phoneNumberId: string | null | undefined;
}) {
  const { config, workStart, workEnd } = await loadConfig();
  if (!config.enabled || !isOutsideBusinessHours(config, workStart, workEnd)) return false;

  // Aunque ya se haya respondido recientemente, seguimos bloqueando al agente normal
  // mientras el negocio esté fuera de horario para evitar respuestas dobles o contradictorias.
  if (await wasRecentlySent(input.leadId, config.cooldownHours)) return true;

  const url = normalizeUrl(config.selfServiceUrl) || getDefaultSelfServiceUrl();
  const body = config.message || DEFAULT_MESSAGE;
  const text = url
    ? body.includes("{{link}}")
      ? body.replace(/\{\{link\}\}/g, url)
      : `${body}\n\n${url}`
    : body.replace(/\{\{link\}\}/g, "").trim();

  if (!input.phoneNumberId) {
    await prisma.notification.create({
      data: {
        type: "crm_away_error",
        message: "No se pudo enviar el mensaje de ausencia: falta el phone_number_id de WhatsApp.",
      },
    });
    return true;
  }

  try {
    await sendWhatsAppAwayMessage({
      leadId: input.leadId,
      whatsappId: input.whatsappId,
      phoneNumberId: String(input.phoneNumberId),
      text,
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "CrmActivity" ("id", "leadId", "type", "text", "meta", "createdAt") VALUES ($1, $2, 'AWAY_AUTO_REPLY', 'Mensaje de ausencia automático enviado', $3::jsonb, NOW())`,
      randomUUID(),
      input.leadId,
      JSON.stringify({ workStart, workEnd, timezone: config.timezone, selfServiceUrl: url })
    );

    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "status"=CASE WHEN "status"='NEW' THEN 'CONTACTED' ELSE "status" END, "capLabel"='FUERA DE HORARIO', "capNextStep"='Retomar conversación al iniciar jornada', "capSequence"='MESSAGE', "updatedAt"=NOW() WHERE "id"=$1`,
      input.leadId
    );
  } catch (error: any) {
    console.error("[AWAY_MESSAGE] Send error", error);
    await prisma.notification.create({
      data: {
        type: "crm_away_error",
        message: `No se pudo enviar el mensaje de ausencia: ${error?.message || "error desconocido"}`,
      },
    });
  }

  return true;
}
