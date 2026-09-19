import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { addSalesActivity, ensureSalesTables, makeQuoteNumber } from "@/lib/sales-system";

export const dynamic = "force-dynamic";

async function quoteDetail(id: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT q.*, o."title" AS "opportunityTitle", o."stage" AS "opportunityStage",
            o."assignedSellerId", o."assignedSellerName", o."leadId", o."city"
     FROM "Quote" q JOIN "Opportunity" o ON o."id"=q."opportunityId"
     WHERE q."id"=$1 LIMIT 1`,
    id
  );
  if (!rows[0]) return null;
  const items = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "QuoteItem" WHERE "quoteId"=$1 ORDER BY "createdAt" ASC`,
    id
  );
  return { ...rows[0], items };
}

export async function GET(req: NextRequest) {
  try {
    await ensureSalesTables();
    const id = req.nextUrl.searchParams.get("id");
    const opportunityId = req.nextUrl.searchParams.get("opportunityId");
    if (id) {
      const q = await quoteDetail(id);
      if (!q) return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
      return NextResponse.json(q);
    }
    const where = opportunityId ? `WHERE q."opportunityId"=$1` : "";
    const rows = opportunityId
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT q.*,o."title" AS "opportunityTitle",o."stage" AS "opportunityStage" FROM "Quote" q JOIN "Opportunity" o ON o."id"=q."opportunityId" ${where} ORDER BY q."createdAt" DESC LIMIT 500`,
          opportunityId
        )
      : await prisma.$queryRawUnsafe<any[]>(
          `SELECT q.*,o."title" AS "opportunityTitle",o."stage" AS "opportunityStage" FROM "Quote" q JOIN "Opportunity" o ON o."id"=q."opportunityId" ORDER BY q."createdAt" DESC LIMIT 500`
        );
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[QUOTES_GET]", error);
    return NextResponse.json({ error: "No se pudieron cargar las cotizaciones" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSalesTables();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const body = await req.json();
    const opportunityId = String(body?.opportunityId || "");
    const requestedItems = Array.isArray(body?.items) ? body.items : [];
    if (!opportunityId || !requestedItems.length) return NextResponse.json({ error: "Selecciona oportunidad y productos" }, { status: 400 });

    const oppRows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Opportunity" WHERE "id"=$1 LIMIT 1`, opportunityId);
    const opp = oppRows[0];
    if (!opp) return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });

    const built: any[] = [];
    for (const item of requestedItems) {
      const qty = Math.max(1, Math.round(Number(item?.qty || 1)));
      if (item?.variantId) {
        const variant = await prisma.variant.findUnique({ where: { id: String(item.variantId) }, include: { product: true } });
        if (!variant || !variant.active) return NextResponse.json({ error: "Una variante ya no está disponible" }, { status: 409 });
        const price = Number(variant.promoPrice ?? variant.price);
        built.push({ productId: variant.productId, variantId: variant.id, sku: variant.sku, name: `${variant.product.name} · ${variant.name}`, qty, unitPrice: price, total: price * qty });
      } else {
        const product = await prisma.product.findUnique({ where: { id: String(item?.productId || "") } });
        if (!product || product.status !== "PUBLISHED" || product.price == null) return NextResponse.json({ error: "Un producto no tiene precio disponible" }, { status: 409 });
        const price = Number(product.promoPrice ?? product.price);
        built.push({ productId: product.id, variantId: null, sku: product.sku, name: product.name, qty, unitPrice: price, total: price * qty });
      }
    }

    const subtotal = built.reduce((s, x) => s + x.total, 0);
    const shipping = Math.max(0, Number(body?.shipping || 0));
    const total = subtotal + shipping;
    const quoteId = randomUUID();
    const number = await makeQuoteNumber();
    const validUntil = body?.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 7 * 864e5);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "Quote" ("id","number","opportunityId","status","customerName","phone","subtotal","shipping","total","notes","validUntil","createdByUserId","createdByName","createdAt","updatedAt")
         VALUES ($1,$2,$3,'DRAFT',$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())`,
        quoteId, number, opportunityId, opp.customerName || null, opp.phone || null, subtotal, shipping, total,
        body?.notes || null, validUntil, session.userId, session.name
      );
      for (const item of built) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "QuoteItem" ("id","quoteId","productId","variantId","sku","name","qty","unitPrice","total","createdAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
          randomUUID(), quoteId, item.productId, item.variantId, item.sku, item.name, item.qty, item.unitPrice, item.total
        );
      }
      await tx.$executeRawUnsafe(
        `UPDATE "Opportunity" SET "value"=$2,"stage"=CASE WHEN "stage"='NEW' THEN 'QUOTED' WHEN "stage"='CONTACTED' THEN 'QUOTED' ELSE "stage" END,"updatedAt"=NOW() WHERE "id"=$1`,
        opportunityId, total
      );
      if (opp.leadId) await tx.$executeRawUnsafe(`UPDATE "Lead" SET "status"='QUOTED',"updatedAt"=NOW() WHERE "id"=$1 AND "status" NOT IN ('CLOSED','LOST')`, opp.leadId);
    });

    await addSalesActivity({ opportunityId, type: "QUOTE_CREATED", text: `Cotización ${number} creada por $${Math.round(total).toLocaleString("es-CO")}`, actorUserId: session.userId, actorName: session.name, meta: { quoteId, number, total } });
    return NextResponse.json(await quoteDetail(quoteId), { status: 201 });
  } catch (error: any) {
    console.error("[QUOTES_POST]", error);
    return NextResponse.json({ error: error?.message || "No se pudo crear la cotización" }, { status: 500 });
  }
}

async function nextOrderNumber(tx: any) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(57392026)");
  const existing = await tx.order.findMany({ select: { number: true }, where: { number: { startsWith: "WT-" } } });
  let max = 0;
  for (const row of existing) {
    const m = /^WT-(\d{6})$/.exec(row.number);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `WT-${String(max + 1).padStart(6, "0")}`;
}

export async function PUT(req: NextRequest) {
  try {
    await ensureSalesTables();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const body = await req.json();
    const id = String(body?.id || "");
    if (!id) return NextResponse.json({ error: "Cotización requerida" }, { status: 400 });
    const current = await quoteDetail(id);
    if (!current) return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });

    if (body?.action === "convert-to-order") {
      const customer = current.phone ? await prisma.customer.findFirst({ where: { phone: current.phone } }) : null;
      if (!customer?.address || !customer?.city || !customer?.phone) {
        return NextResponse.json({ error: "Completa teléfono, ciudad y dirección del cliente antes de convertir la cotización en pedido" }, { status: 409 });
      }
      const existing = await prisma.order.findFirst({ where: { notes: { contains: `quote:${id}` } }, select: { id: true, number: true } });
      if (existing) return NextResponse.json({ ok: true, orderId: existing.id, orderNumber: existing.number, duplicate: true });

      const order = await prisma.$transaction(async (tx) => {
        const number = await nextOrderNumber(tx);
        const meta = {
          requestId: `quote:${id}`,
          origin: "COTIZACION",
          assignedSellerId: current.assignedSellerId || null,
          assignedSellerName: current.assignedSellerName || null,
          internalNote: `Convertido desde ${current.number}`,
          stockValidated: false,
          inventoryApplied: false,
          shippingQuoted: true,
        };
        const created = await tx.order.create({
          data: {
            number,
            customerId: customer.id,
            subtotal: Number(current.subtotal),
            shipping: Number(current.shipping),
            total: Number(current.total),
            paymentMethod: "Por confirmar",
            notes: `[WT_META]${JSON.stringify(meta)}[/WT_META]\nCotización origen: ${current.number}`,
            items: {
              create: current.items.map((it: any) => ({
                name: it.name,
                sku: it.sku,
                qty: it.qty,
                unitPrice: Number(it.unitPrice),
                total: Number(it.total),
                productId: it.productId || null,
                variantId: it.variantId || null,
              })),
            },
            history: { create: { action: `Pedido creado desde cotización ${current.number}`, actor: session.name } },
          },
        });
        await tx.$executeRawUnsafe(`UPDATE "Quote" SET "status"='ACCEPTED',"updatedAt"=NOW() WHERE "id"=$1`, id);
        await tx.$executeRawUnsafe(`UPDATE "Opportunity" SET "stage"='WON',"wonAt"=COALESCE("wonAt",NOW()),"lostAt"=NULL,"updatedAt"=NOW() WHERE "id"=$1`, current.opportunityId);
        if (current.leadId) await tx.$executeRawUnsafe(`UPDATE "Lead" SET "status"='CLOSED',"updatedAt"=NOW() WHERE "id"=$1`, current.leadId);
        await tx.notification.create({ data: { type: "quote_converted", message: `${current.number} convertida en pedido ${number}` } });
        return created;
      });
      await addSalesActivity({ opportunityId: current.opportunityId, type: "ORDER_CREATED", text: `${current.number} convertida en pedido ${order.number}`, actorUserId: session.userId, actorName: session.name, meta: { orderId: order.id } });
      return NextResponse.json({ ok: true, orderId: order.id, orderNumber: order.number });
    }

    const status = String(body?.status || "");
    if (!["DRAFT","SENT","ACCEPTED","REJECTED","EXPIRED"].includes(status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    await prisma.$executeRawUnsafe(`UPDATE "Quote" SET "status"=$2,"updatedAt"=NOW() WHERE "id"=$1`, id, status);
    if (status === "SENT") {
      await prisma.$executeRawUnsafe(`UPDATE "Opportunity" SET "stage"='QUOTED',"updatedAt"=NOW() WHERE "id"=$1 AND "stage" NOT IN ('WON','LOST')`, current.opportunityId);
    }
    if (status === "REJECTED") {
      await prisma.$executeRawUnsafe(`UPDATE "Opportunity" SET "stage"='NEGOTIATION',"updatedAt"=NOW() WHERE "id"=$1 AND "stage" NOT IN ('WON','LOST')`, current.opportunityId);
    }
    await addSalesActivity({ opportunityId: current.opportunityId, type: "QUOTE_STATUS", text: `${current.number}: ${status}`, actorUserId: session.userId, actorName: session.name });
    return NextResponse.json(await quoteDetail(id));
  } catch (error: any) {
    console.error("[QUOTES_PUT]", error);
    return NextResponse.json({ error: error?.message || "No se pudo actualizar la cotización" }, { status: 500 });
  }
}
