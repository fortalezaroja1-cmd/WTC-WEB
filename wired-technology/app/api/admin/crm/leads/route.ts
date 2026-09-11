import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureCrmTables } from "@/lib/crm";

export const dynamic = "force-dynamic";

async function getLead(id: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "Lead" WHERE "id" = $1 LIMIT 1`,
    id
  );
  return rows[0] || null;
}

async function addActivity(leadId: string, type: string, text: string, meta: unknown = {}) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CrmActivity" ("id", "leadId", "type", "text", "meta", "createdAt") VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
    randomUUID(),
    leadId,
    type,
    text,
    JSON.stringify(meta ?? {})
  );
}

export async function GET(request: NextRequest) {
  try {
    await ensureCrmTables();
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId");

    if (leadId) {
      const lead = await getLead(leadId);
      if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

      const [messages, activities] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "CrmMessage" WHERE "leadId" = $1 ORDER BY "sentAt" ASC, "createdAt" ASC LIMIT 500`,
          leadId
        ),
        prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "CrmActivity" WHERE "leadId" = $1 ORDER BY "createdAt" DESC LIMIT 100`,
          leadId
        ),
      ]);
      return NextResponse.json({ ...lead, messages, activities });
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

    const current = await getLead(id);
    if (!current) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

    if (body?.action === "mark-read") {
      await prisma.$executeRawUnsafe(
        `UPDATE "Lead" SET "unreadCount" = 0, "updatedAt" = NOW() WHERE "id" = $1`,
        id
      );
    } else if (body?.action === "cap-answer") {
      if (!current.capPending) {
        return NextResponse.json({ error: "Esta gestión CAP ya fue completada" }, { status: 409 });
      }

      const step = String(body?.step || "").toUpperCase();
      const answer = String(body?.answer || "").toUpperCase();
      const expectedStep = String(current.capStep || "C").toUpperCase();
      if (!step || step !== expectedStep) {
        return NextResponse.json({ error: `Debes completar primero el paso ${expectedStep}` }, { status: 409 });
      }

      if (step === "C") {
        if (answer === "NO") {
          await prisma.$executeRawUnsafe(
            `UPDATE "Lead" SET "capC" = true, "capStep" = 'A', "updatedAt" = NOW() WHERE "id" = $1`,
            id
          );
          await addActivity(id, "CAP", "C · No se puede cerrar todavía. Pasa a ACORDAR.", { step: "C", answer: "NO" });
        } else if (answer === "YES") {
          const closeReady = Boolean(body?.closeReady);
          const shippingConfirmed = Boolean(body?.shippingConfirmed);
          const productConfirmed = Boolean(body?.productConfirmed);
          const preDispatchSent = Boolean(body?.preDispatchSent);
          if (!closeReady || !shippingConfirmed || !productConfirmed || !preDispatchSent) {
            return NextResponse.json({ error: "Para CERRAR debes completar toda la verificación: pedido, datos de envío, color/cantidad y verificación pre-despacho" }, { status: 400 });
          }
          await prisma.$executeRawUnsafe(
            `
              UPDATE "Lead"
              SET "capC" = true,
                  "capPending" = false,
                  "capDecision" = 'C',
                  "capLabel" = 'POR-CERRAR',
                  "capNextStep" = 'Confirmar pedido y programar despacho',
                  "capNextAt" = NULL,
                  "capSequence" = NULL,
                  "capCompletedAt" = NOW(),
                  "updatedAt" = NOW()
              WHERE "id" = $1
            `,
            id
          );
          await addActivity(id, "CAP", "C · CERRAR completado. Etiqueta POR-CERRAR.", {
            step: "C",
            answer: "YES",
            label: "POR-CERRAR",
            checks: { closeReady, shippingConfirmed, productConfirmed, preDispatchSent },
          });
        } else {
          return NextResponse.json({ error: "Respuesta CAP inválida" }, { status: 400 });
        }
      } else if (step === "A") {
        if (answer === "NO") {
          await prisma.$executeRawUnsafe(
            `UPDATE "Lead" SET "capA" = true, "capStep" = 'P', "updatedAt" = NOW() WHERE "id" = $1`,
            id
          );
          await addActivity(id, "CAP", "A · No se logró acordar un siguiente paso. Pasa a PLANEAR.", { step: "A", answer: "NO" });
        } else if (answer === "YES") {
          const nextStep = String(body?.nextStep || "").trim();
          const nextAt = body?.nextAt ? new Date(body.nextAt) : null;
          const label = ["COTIZADO", "SEGUIMIENTO"].includes(String(body?.label || "").toUpperCase())
            ? String(body.label).toUpperCase()
            : "SEGUIMIENTO";
          if (!nextStep || !nextAt || Number.isNaN(nextAt.getTime())) {
            return NextResponse.json({ error: "ACORDAR exige un siguiente paso concreto y una fecha" }, { status: 400 });
          }
          await prisma.$executeRawUnsafe(
            `
              UPDATE "Lead"
              SET "capA" = true,
                  "capPending" = false,
                  "capDecision" = 'A',
                  "capLabel" = $2,
                  "capNextStep" = $3,
                  "capNextAt" = $4,
                  "capSequence" = NULL,
                  "capCompletedAt" = NOW(),
                  "updatedAt" = NOW()
              WHERE "id" = $1
            `,
            id,
            label,
            nextStep,
            nextAt
          );
          await addActivity(id, "CAP", `A · ACORDADO: ${nextStep}`, { step: "A", answer: "YES", label, nextStep, nextAt });
        } else {
          return NextResponse.json({ error: "Respuesta CAP inválida" }, { status: 400 });
        }
      } else if (step === "P") {
        const nextStep = String(body?.nextStep || "").trim() || "Seguimiento comercial";
        const nextAt = body?.nextAt ? new Date(body.nextAt) : null;
        const sequence = String(body?.sequence || "").toUpperCase();
        if (!nextAt || Number.isNaN(nextAt.getTime())) {
          return NextResponse.json({ error: "PLANEAR exige fecha y hora de seguimiento" }, { status: 400 });
        }
        if (!["MESSAGE", "CALL", "LAST_MESSAGE"].includes(sequence)) {
          return NextResponse.json({ error: "Selecciona el paso de seguimiento: mensaje, llamada o último mensaje" }, { status: 400 });
        }
        await prisma.$executeRawUnsafe(
          `
            UPDATE "Lead"
            SET "capP" = true,
                "capPending" = false,
                "capDecision" = 'P',
                "capLabel" = 'SEGUIMIENTO',
                "capNextStep" = $2,
                "capNextAt" = $3,
                "capSequence" = $4,
                "capCompletedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE "id" = $1
          `,
          id,
          nextStep,
          nextAt,
          sequence
        );
        await addActivity(id, "CAP", `P · PLANEAR: ${nextStep}`, { step: "P", answer: "YES", label: "SEGUIMIENTO", nextStep, nextAt, sequence });
      } else {
        return NextResponse.json({ error: "Paso CAP inválido" }, { status: 400 });
      }
    } else {
      const requestedStatus = body?.status !== undefined ? String(body.status) : null;
      if (requestedStatus && current.capPending && !["NEW", "CONTACTED"].includes(requestedStatus)) {
        return NextResponse.json({ error: "CAP obligatorio: antes de avanzar el lead debes resolver CERRAR, ACORDAR o PLANEAR" }, { status: 409 });
      }
      if (requestedStatus === "CLOSED" && current.capDecision !== "C") {
        return NextResponse.json({ error: "Un lead solo puede pasar a CERRADO después de resolver CAP por CERRAR" }, { status: 409 });
      }

      const allowed: Record<string, string> = {
        status: "status",
        assignedSellerId: "assignedSellerId",
        assignedSellerName: "assignedSellerName",
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

    const updated = await getLead(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[CRM_LEADS] Update error", error);
    return NextResponse.json({ error: "No se pudo actualizar el lead" }, { status: 500 });
  }
}