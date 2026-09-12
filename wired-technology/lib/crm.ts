import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

let crmTablesReady: Promise<void> | null = null;

export function ensureCrmTables() {
  if (!crmTablesReady) {
    crmTablesReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Lead" (
          "id" TEXT PRIMARY KEY,
          "whatsappId" TEXT NOT NULL,
          "externalContactId" TEXT,
          "channelAccountId" TEXT,
          "phone" TEXT,
          "name" TEXT,
          "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
          "source" TEXT NOT NULL DEFAULT 'WHATSAPP',
          "status" TEXT NOT NULL DEFAULT 'NEW',
          "assignedSellerId" TEXT,
          "assignedSellerName" TEXT,
          "capC" BOOLEAN NOT NULL DEFAULT false,
          "capA" BOOLEAN NOT NULL DEFAULT false,
          "capP" BOOLEAN NOT NULL DEFAULT false,
          "capPending" BOOLEAN NOT NULL DEFAULT true,
          "capStep" TEXT NOT NULL DEFAULT 'C',
          "capDecision" TEXT,
          "capLabel" TEXT,
          "capNextStep" TEXT,
          "capNextAt" TIMESTAMP(3),
          "capSequence" TEXT,
          "capCompletedAt" TIMESTAMP(3),
          "unreadCount" INTEGER NOT NULL DEFAULT 0,
          "lastMessageText" TEXT,
          "lastMessageAt" TIMESTAMP(3),
          "lastInboundAt" TIMESTAMP(3),
          "lastOutboundAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "externalContactId" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "channelAccountId" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "unreadCount" INTEGER NOT NULL DEFAULT 0`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastInboundAt" TIMESTAMP(3)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastOutboundAt" TIMESTAMP(3)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "capPending" BOOLEAN NOT NULL DEFAULT true`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "capStep" TEXT NOT NULL DEFAULT 'C'`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "capDecision" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "capLabel" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "capNextStep" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "capNextAt" TIMESTAMP(3)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "capSequence" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "capCompletedAt" TIMESTAMP(3)`);
      await prisma.$executeRawUnsafe(`UPDATE "Lead" SET "externalContactId"=COALESCE("externalContactId","whatsappId") WHERE "externalContactId" IS NULL`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Lead_whatsappId_key" ON "Lead"("whatsappId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_channel_external_idx" ON "Lead"("channel", "externalContactId", "channelAccountId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_lastMessageAt_idx" ON "Lead"("lastMessageAt" DESC)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_capNextAt_idx" ON "Lead"("capNextAt")`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CrmMessage" (
          "id" TEXT PRIMARY KEY,
          "metaMessageId" TEXT NOT NULL,
          "leadId" TEXT NOT NULL,
          "direction" TEXT NOT NULL DEFAULT 'INBOUND',
          "type" TEXT NOT NULL DEFAULT 'text',
          "text" TEXT,
          "payload" JSONB,
          "sentAt" TIMESTAMP(3) NOT NULL,
          "senderType" TEXT,
          "senderUserId" TEXT,
          "senderUserName" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CrmMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CrmMessage" ADD COLUMN IF NOT EXISTS "senderType" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CrmMessage" ADD COLUMN IF NOT EXISTS "senderUserId" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CrmMessage" ADD COLUMN IF NOT EXISTS "senderUserName" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CrmMessage_metaMessageId_key" ON "CrmMessage"("metaMessageId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CrmMessage_leadId_sentAt_idx" ON "CrmMessage"("leadId", "sentAt" DESC)`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CrmActivity" (
          "id" TEXT PRIMARY KEY,
          "leadId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "text" TEXT NOT NULL,
          "meta" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CrmActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CrmActivity_leadId_createdAt_idx" ON "CrmActivity"("leadId", "createdAt" DESC)`);
      await prisma.$executeRawUnsafe(`UPDATE "CrmMessage" SET "senderType"='LEGACY' WHERE "direction"='OUTBOUND' AND "senderType" IS NULL`);
      await prisma.$executeRawUnsafe(`
        UPDATE "Lead"
        SET "capPending" = false,
            "capDecision" = COALESCE("capDecision", 'LEGACY'),
            "capCompletedAt" = COALESCE("capCompletedAt", "updatedAt")
        WHERE "capC" = true AND "capA" = true AND "capP" = true AND "capDecision" IS NULL
      `);
    })().catch((error) => {
      crmTablesReady = null;
      throw error;
    });
  }
  return crmTablesReady;
}

export type InboundWhatsAppMessage = {
  metaMessageId: string;
  whatsappId: string;
  externalContactId?: string | null;
  channelAccountId?: string | null;
  channel?: "WHATSAPP" | "INSTAGRAM" | "MESSENGER";
  phone?: string | null;
  name?: string | null;
  type: string;
  text?: string | null;
  sentAt: Date;
  source?: string;
  payload: unknown;
};

export type InboundChannelMessage = InboundWhatsAppMessage;

export async function saveInboundWhatsAppMessage(input: InboundWhatsAppMessage) {
  await ensureCrmTables();

  const channel = input.channel || "WHATSAPP";
  const externalContactId = String(input.externalContactId || input.whatsappId);
  const channelAccountId = input.channelAccountId ? String(input.channelAccountId) : null;
  const identityKey = channel === "WHATSAPP"
    ? String(input.whatsappId)
    : `${channel}:${channelAccountId || "default"}:${externalContactId}`;
  const phone = channel === "WHATSAPP" ? (input.phone || externalContactId) : (input.phone || null);
  const source = input.source || channel;

  const leadId = randomUUID();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "Lead" (
        "id", "whatsappId", "externalContactId", "channelAccountId", "phone", "name", "channel", "source", "status",
        "lastMessageText", "lastMessageAt", "lastInboundAt", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NEW', $9, $10, $10, NOW(), NOW())
      ON CONFLICT ("whatsappId") DO UPDATE SET
        "externalContactId" = EXCLUDED."externalContactId",
        "channelAccountId" = EXCLUDED."channelAccountId",
        "phone" = COALESCE(EXCLUDED."phone", "Lead"."phone"),
        "name" = COALESCE(EXCLUDED."name", "Lead"."name"),
        "channel" = EXCLUDED."channel",
        "source" = CASE WHEN "Lead"."source" = 'META_TEST' THEN EXCLUDED."source" ELSE "Lead"."source" END,
        "lastMessageText" = EXCLUDED."lastMessageText",
        "lastMessageAt" = EXCLUDED."lastMessageAt",
        "lastInboundAt" = EXCLUDED."lastInboundAt",
        "capPending" = true,
        "capStep" = 'C',
        "capC" = false,
        "capA" = false,
        "capP" = false,
        "capDecision" = NULL,
        "capLabel" = NULL,
        "capNextStep" = NULL,
        "capNextAt" = NULL,
        "capSequence" = NULL,
        "capCompletedAt" = NULL,
        "updatedAt" = NOW()
      RETURNING "id"
    `,
    leadId,
    identityKey,
    externalContactId,
    channelAccountId,
    phone,
    input.name || null,
    channel,
    source,
    input.text || null,
    input.sentAt,
  );

  const resolvedLeadId = rows[0]?.id;
  if (!resolvedLeadId) throw new Error("No se pudo crear o actualizar el lead");

  const inserted = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "CrmMessage" (
        "id", "metaMessageId", "leadId", "direction", "type", "text", "payload", "sentAt", "senderType", "createdAt"
      )
      VALUES ($1, $2, $3, 'INBOUND', $4, $5, $6::jsonb, $7, 'CLIENT', NOW())
      ON CONFLICT ("metaMessageId") DO NOTHING
      RETURNING "id"
    `,
    randomUUID(), input.metaMessageId, resolvedLeadId, input.type, input.text || null,
    JSON.stringify(input.payload ?? {}), input.sentAt
  );

  if (inserted.length) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Lead" SET "unreadCount" = "unreadCount" + 1, "updatedAt" = NOW() WHERE "id" = $1`,
      resolvedLeadId
    );
    const label = input.name || input.phone || externalContactId;
    const channelLabel = channel === "WHATSAPP" ? "WhatsApp" : channel === "INSTAGRAM" ? "Instagram" : "Messenger";
    await prisma.notification.create({
      data: {
        type: "channel_lead",
        message: `Nuevo mensaje de ${channelLabel}: ${label}${input.text ? ` — ${input.text.slice(0, 120)}` : ""}`,
      },
    });
  }

  return { leadId: resolvedLeadId, inserted: inserted.length > 0, channel, externalContactId, channelAccountId };
}

export const saveInboundChannelMessage = saveInboundWhatsAppMessage;

export async function saveOutboundWhatsAppMessage(input: {
  leadId: string;
  metaMessageId: string;
  text: string;
  sentAt?: Date;
  payload?: unknown;
  senderType?: "HUMAN" | "AGENT" | "SYSTEM" | "AWAY" | "LEGACY";
  senderUserId?: string | null;
  senderUserName?: string | null;
}) {
  await ensureCrmTables();
  const sentAt = input.sentAt || new Date();
  const senderType = input.senderType || "SYSTEM";

  await prisma.$queryRawUnsafe(
    `
      INSERT INTO "CrmMessage" (
        "id", "metaMessageId", "leadId", "direction", "type", "text", "payload", "sentAt",
        "senderType", "senderUserId", "senderUserName", "createdAt"
      )
      VALUES ($1, $2, $3, 'OUTBOUND', 'text', $4, $5::jsonb, $6, $7, $8, $9, NOW())
      ON CONFLICT ("metaMessageId") DO NOTHING
    `,
    randomUUID(), input.metaMessageId, input.leadId, input.text, JSON.stringify(input.payload ?? {}), sentAt,
    senderType, input.senderUserId || null, input.senderUserName || null
  );

  await prisma.$executeRawUnsafe(
    `
      UPDATE "Lead"
      SET "lastMessageText" = $2,
          "lastMessageAt" = $3,
          "lastOutboundAt" = $3,
          "unreadCount" = 0,
          "status" = CASE WHEN "status" = 'NEW' THEN 'CONTACTED' ELSE "status" END,
          "capPending" = true,
          "capStep" = 'C',
          "capC" = false,
          "capA" = false,
          "capP" = false,
          "capDecision" = NULL,
          "capLabel" = NULL,
          "capNextStep" = NULL,
          "capNextAt" = NULL,
          "capSequence" = NULL,
          "capCompletedAt" = NULL,
          "updatedAt" = NOW()
      WHERE "id" = $1
    `,
    input.leadId, input.text, sentAt
  );
}

export const saveOutboundChannelMessage = saveOutboundWhatsAppMessage;

export async function escalateUnansweredLeadsToCall() {
  await ensureCrmTables();

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string | null; phone: string | null; assignedSellerName: string | null }>>(`
    UPDATE "Lead"
    SET "capPending" = false,
        "capC" = false,
        "capA" = false,
        "capP" = true,
        "capStep" = 'P',
        "capDecision" = 'P',
        "capLabel" = 'LLAMADA',
        "capNextStep" = 'Llamar al cliente por falta de respuesta',
        "capNextAt" = NOW(),
        "capSequence" = 'CALL',
        "capCompletedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "lastOutboundAt" IS NOT NULL
      AND "lastOutboundAt" <= NOW() - INTERVAL '24 hours'
      AND ("lastInboundAt" IS NULL OR "lastInboundAt" < "lastOutboundAt")
      AND "status" NOT IN ('CLOSED', 'LOST')
      AND COALESCE("capLabel", '') <> 'LLAMADA'
      AND COALESCE("capDecision", '') <> 'C'
      AND NOT ("capDecision" = 'A' AND "capNextAt" IS NOT NULL AND "capNextAt" > NOW())
    RETURNING "id", "name", "phone", "assignedSellerName"
  `);

  for (const lead of rows) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CrmActivity" ("id", "leadId", "type", "text", "meta", "createdAt") VALUES ($1, $2, 'ESCALATION', $3, $4::jsonb, NOW())`,
      randomUUID(), lead.id, "Sin respuesta durante 24h · escalado automáticamente a LLAMADA",
      JSON.stringify({ rule: "NO_RESPONSE_24H", sequence: "CALL" })
    );
    await prisma.notification.create({
      data: {
        type: "crm_call_due",
        message: `Llamar a ${lead.name || lead.phone || "cliente"}: 24h sin respuesta${lead.assignedSellerName ? ` · ${lead.assignedSellerName}` : ""}`,
      },
    });
  }

  return rows;
}
