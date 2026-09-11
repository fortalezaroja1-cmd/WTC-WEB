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
        `SELECT * FROM "CrmMessage" WHERE "leadId" = $1 ORDER BY "sentAt" ASC, "createdAt" ASC LIMIT 500`,
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
      ORDER BY l."lastMessageAt" DESC NULLS LAST, l."updatedAt" DESC
      LIMIT 500
    `);

    return NextResponse.json(leads);
  } catch (error) {
    console.error("[CRM_LEADS] Error", error);
    return NextResponse.json({ error: "No se pudieron cargar los leads" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureCrmTables();
    const body = await request.json();
    const id = String(body?.id || "");
    if (!id) return NextResponse.json({ error: "Lead requerido" }, { status: 400 });

    if (body?.action === "mark-read") {
      await prisma.$executeRawUnsafe(
        `UPDATE "Lead" SET "unreadCount" = 0, "updatedAt" = NOW() WHERE "id" = $1`,
        id
      );
    } else {
      const allowed: Record<string, string> = {
        status: "status",
        assignedSellerId: "assignedSellerId",
        assignedSellerName: "assignedSellerName",
        capC: "capC",
        capA: "capA",
        capP: "capP",
        name: "name",
        phone: "phone",
      };

      const sets: string[] = [];
      const values: unknown[] = [id];
      for (const [key, column] of Object.entries(allowed)) {
        if (body[key] === undefined) continue;
        values.push(body[key] === "" ? null : body[key]);
        sets.push(`"${column}" = $${values.length}`);
      }

      if (!sets.length) return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
      sets.push(`"updatedAt" = NOW()`);
      await prisma.$executeRawUnsafe(
        `UPDATE "Lead" SET ${sets.join(", ")} WHERE "id" = $1`,
        ...values
      );
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Lead" WHERE "id" = $1 LIMIT 1`,
      id
    );
    if (!rows.length) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[CRM_LEADS] Update error", error);
    return NextResponse.json({ error: "No se pudo actualizar el lead" }, { status: 500 });
  }
}
