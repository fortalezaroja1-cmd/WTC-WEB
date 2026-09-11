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
          "lastMessageText" TEXT,
          "lastMessageAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Lead_whatsappId_key" ON "Lead"("whatsappId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_lastMessageAt_idx" ON "Lead"("lastMessageAt" DESC)`);

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
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CrmMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CrmMessage_metaMessageId_key" ON "CrmMessage"("metaMessageId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CrmMessage_leadId_sentAt_idx" ON "CrmMessage"("leadId", "sentAt" DESC)`);
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
  phone?: string | null;
  name?: string | null;
  type: string;
  text?: string | null;
  sentAt: Date;
  source?: string;
  payload: unknown;
};

export async function saveInboundWhatsAppMessage(input: InboundWhatsAppMessage) {
  await ensureCrmTables();

  const leadId = randomUUID();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "Lead" (
        "id", "whatsappId", "phone", "name", "channel", "source", "status",
        "lastMessageText", "lastMessageAt", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, 'WHATSAPP', $5, 'NEW', $6, $7, NOW(), NOW())
      ON CONFLICT ("whatsappId") DO UPDATE SET
        "phone" = COALESCE(EXCLUDED."phone", "Lead"."phone"),
        "name" = COALESCE(EXCLUDED."name", "Lead"."name"),
        "source" = CASE WHEN "Lead"."source" = 'META_TEST' THEN EXCLUDED."source" ELSE "Lead"."source" END,
        "lastMessageText" = EXCLUDED."lastMessageText",
        "lastMessageAt" = EXCLUDED."lastMessageAt",
        "updatedAt" = NOW()
      RETURNING "id"
    `,
    leadId,
    input.whatsappId,
    input.phone || input.whatsappId,
    input.name || null,
    input.source || "WHATSAPP",
    input.text || null,
    input.sentAt
  );

  const resolvedLeadId = rows[0]?.id;
  if (!resolvedLeadId) throw new Error("No se pudo crear o actualizar el lead");

  const inserted = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "CrmMessage" (
        "id", "metaMessageId", "leadId", "direction", "type", "text", "payload", "sentAt", "createdAt"
      )
      VALUES ($1, $2, $3, 'INBOUND', $4, $5, $6::jsonb, $7, NOW())
      ON CONFLICT ("metaMessageId") DO NOTHING
      RETURNING "id"
    `,
    randomUUID(),
    input.metaMessageId,
    resolvedLeadId,
    input.type,
    input.text || null,
    JSON.stringify(input.payload ?? {}),
    input.sentAt
  );

  if (inserted.length) {
    const label = input.name || input.phone || input.whatsappId;
    await prisma.notification.create({
      data: {
        type: "whatsapp_lead",
        message: `Nuevo mensaje de WhatsApp: ${label}${input.text ? ` — ${input.text.slice(0, 120)}` : ""}`,
      },
    });
  }

  return { leadId: resolvedLeadId, inserted: inserted.length > 0 };
}
