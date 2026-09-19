import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { ensureCrmTables } from "@/lib/crm";

let salesTablesReady: Promise<void> | null = null;

export const OPPORTUNITY_STAGES = ["NEW","CONTACTED","QUOTED","NEGOTIATION","WON","LOST"] as const;
export type OpportunityStage = typeof OPPORTUNITY_STAGES[number];

export function mapLeadStatusToOpportunity(status: string | null | undefined): OpportunityStage {
  switch (String(status || "NEW").toUpperCase()) {
    case "CONTACTED": return "CONTACTED";
    case "QUOTED": return "QUOTED";
    case "NEGOTIATION": return "NEGOTIATION";
    case "CLOSED":
    case "DELIVERED": return "WON";
    case "LOST": return "LOST";
    default: return "NEW";
  }
}

export async function ensureSalesTables() {
  if (!salesTablesReady) {
    salesTablesReady = (async () => {
      await ensureCrmTables();

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Opportunity" (
          "id" TEXT PRIMARY KEY,
          "leadId" TEXT UNIQUE,
          "customerId" TEXT,
          "customerName" TEXT,
          "phone" TEXT,
          "email" TEXT,
          "city" TEXT,
          "address" TEXT,
          "title" TEXT NOT NULL,
          "value" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "stage" TEXT NOT NULL DEFAULT 'NEW',
          "source" TEXT NOT NULL DEFAULT 'MANUAL',
          "assignedSellerId" TEXT,
          "assignedSellerName" TEXT,
          "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
          "nextAction" TEXT,
          "nextAt" TIMESTAMP(3),
          "lossReason" TEXT,
          "notes" TEXT,
          "wonAt" TIMESTAMP(3),
          "lostAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "address" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Opportunity_stage_idx" ON "Opportunity"("stage")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Opportunity_assigned_idx" ON "Opportunity"("assignedSellerId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Opportunity_nextAt_idx" ON "Opportunity"("nextAt")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Opportunity_phone_idx" ON "Opportunity"("phone")`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SalesActivity" (
          "id" TEXT PRIMARY KEY,
          "opportunityId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "text" TEXT NOT NULL,
          "actorUserId" TEXT,
          "actorName" TEXT,
          "meta" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SalesActivity_opportunityId_fkey"
            FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SalesActivity_opp_created_idx" ON "SalesActivity"("opportunityId","createdAt" DESC)`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Quote" (
          "id" TEXT PRIMARY KEY,
          "number" TEXT UNIQUE NOT NULL,
          "opportunityId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'DRAFT',
          "customerName" TEXT,
          "phone" TEXT,
          "subtotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "shipping" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "total" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "notes" TEXT,
          "validUntil" TIMESTAMP(3),
          "createdByUserId" TEXT,
          "createdByName" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Quote_opportunityId_fkey"
            FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Quote_opp_idx" ON "Quote"("opportunityId","createdAt" DESC)`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "QuoteItem" (
          "id" TEXT PRIMARY KEY,
          "quoteId" TEXT NOT NULL,
          "productId" TEXT,
          "variantId" TEXT,
          "sku" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "qty" INTEGER NOT NULL,
          "unitPrice" NUMERIC(12,2) NOT NULL,
          "total" NUMERIC(12,2) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "QuoteItem_quoteId_fkey"
            FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "QuoteItem_quote_idx" ON "QuoteItem"("quoteId")`);
    })().catch((error) => {
      salesTablesReady = null;
      throw error;
    });
  }
  return salesTablesReady;
}

export async function addSalesActivity(input: {
  opportunityId: string;
  type: string;
  text: string;
  actorUserId?: string | null;
  actorName?: string | null;
  meta?: unknown;
}) {
  await ensureSalesTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SalesActivity" ("id","opportunityId","type","text","actorUserId","actorName","meta","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())`,
    randomUUID(),
    input.opportunityId,
    input.type,
    input.text,
    input.actorUserId || null,
    input.actorName || null,
    JSON.stringify(input.meta ?? {})
  );
}

export async function syncOpportunitiesFromLeads() {
  await ensureSalesTables();
  const leads = await prisma.$queryRawUnsafe<any[]>(`
    SELECT l."id",l."name",l."phone",l."source",l."status",l."assignedSellerId",l."assignedSellerName",
           l."capNextStep",l."capNextAt",l."createdAt",l."updatedAt",
           c."id" AS "customerId",c."name" AS "customerRecordName",c."email",c."city",c."address"
    FROM "Lead" l
    LEFT JOIN LATERAL (
      SELECT "id","name","email","city","address"
      FROM "Customer"
      WHERE "phone" = l."phone" AND l."phone" IS NOT NULL
      ORDER BY "updatedAt" DESC
      LIMIT 1
    ) c ON true
    ORDER BY l."updatedAt" DESC
    LIMIT 1000
  `);

  for (const lead of leads) {
    const stage = mapLeadStatusToOpportunity(lead.status);
    const title = lead.name ? `Venta · ${lead.name}` : `Oportunidad · ${lead.phone || "Cliente"}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Opportunity" (
        "id","leadId","customerId","customerName","phone","email","city","address","title","stage","source","assignedSellerId","assignedSellerName",
        "nextAction","nextAt","createdAt","updatedAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT ("leadId") DO UPDATE SET
        "customerId"=COALESCE(EXCLUDED."customerId","Opportunity"."customerId"),
        "customerName"=COALESCE(EXCLUDED."customerName","Opportunity"."customerName"),
        "phone"=COALESCE(EXCLUDED."phone","Opportunity"."phone"),
        "email"=COALESCE(EXCLUDED."email","Opportunity"."email"),
        "city"=COALESCE(EXCLUDED."city","Opportunity"."city"),
        "address"=COALESCE(EXCLUDED."address","Opportunity"."address"),
        "source"=COALESCE(EXCLUDED."source","Opportunity"."source"),
        "assignedSellerId"=COALESCE(EXCLUDED."assignedSellerId","Opportunity"."assignedSellerId"),
        "assignedSellerName"=COALESCE(EXCLUDED."assignedSellerName","Opportunity"."assignedSellerName"),
        "nextAction"=COALESCE("Opportunity"."nextAction",EXCLUDED."nextAction"),
        "nextAt"=COALESCE("Opportunity"."nextAt",EXCLUDED."nextAt"),
        "stage"=CASE
          WHEN "Opportunity"."stage" IN ('WON','LOST') THEN "Opportunity"."stage"
          ELSE EXCLUDED."stage"
        END,
        "updatedAt"=GREATEST("Opportunity"."updatedAt",EXCLUDED."updatedAt")`,
      randomUUID(),
      lead.id,
      lead.customerId || null,
      lead.name || lead.customerRecordName || null,
      lead.phone || null,
      lead.email || null,
      lead.city || null,
      lead.address || null,
      title,
      stage,
      lead.source || "CRM",
      lead.assignedSellerId || null,
      lead.assignedSellerName || null,
      lead.capNextStep || null,
      lead.capNextAt || null,
      lead.createdAt,
      lead.updatedAt,
    );
  }
}

export async function makeQuoteNumber() {
  await ensureSalesTables();
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS "count" FROM "Quote" WHERE "createdAt" >= DATE_TRUNC('year', NOW())`
  );
  const seq = Number(rows[0]?.count || 0) + 1;
  return `COT-${year}-${String(seq).padStart(5, "0")}`;
}
