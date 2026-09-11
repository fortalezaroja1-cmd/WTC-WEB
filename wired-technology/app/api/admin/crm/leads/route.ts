import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureCrmTables } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureCrmTables();
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId");

    if (leadId) {
      const leads = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Lead" WHERE "id" = $1 LIMIT 1`,
        leadId
      );
      if (!leads.length) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

      const messages = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "CrmMessage" WHERE "leadId" = $1 ORDER BY "sentAt" ASC, "createdAt" ASC LIMIT 200`,
        leadId
      );
      return NextResponse.json({ ...leads[0], messages });
    }

    const leads = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        l.*,
        COALESCE(m."messageCount", 0)::int AS "messageCount"
      FROM "Lead" l
      LEFT JOIN (
        SELECT "leadId", COUNT(*) AS "messageCount"
        FROM "CrmMessage"
        GROUP BY "leadId"
      ) m ON m."leadId" = l."id"
      ORDER BY l."lastMessageAt" DESC NULLS LAST, l."createdAt" DESC
      LIMIT 500
    `);

    return NextResponse.json(leads);
  } catch (error) {
    console.error("[CRM_LEADS] Error", error);
    return NextResponse.json({ error: "No se pudieron cargar los leads" }, { status: 500 });
  }
}
