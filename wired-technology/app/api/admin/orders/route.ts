import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncLeadStageByPhone } from "@/lib/sales-agent";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type OrderMeta = {
  requestId: string;
  origin: string;
  assignedSellerId: string | null;
  assignedSellerName: string | null;
  internalNote: string;
  stockValidated: boolean;
  inventoryApplied: boolean;
};

const DEFAULT_META: OrderMeta = {
  requestId: "",
  origin: "Web",
  assignedSellerId: null,
  assignedSellerName: null,
  internalNote: "",
  stockValidated: false,
  inventoryApplied: false,
};

function parseNotes(notes: string | null) {
  const raw = notes || "";
  const match = raw.match(/\[WT_META\]([\s\S]*?)\[\/WT_META\]/);
  let meta = { ...DEFAULT_META };
  if (match?.[1]) {
    try { meta = { ...meta, ...JSON.parse(match[1]) }; } catch {}
  }
  const publicNotes = raw.replace(/\[WT_META\][\s\S]*?\[\/WT_META\]\s*/, "").trim();
  return { meta, publicNotes };
}

function buildNotes(meta: OrderMeta, publicNotes: string) {
  return `[WT_META]${JSON.stringify(meta)}[/WT_META]${publicNotes ? `\n${publicNotes}` : ""}`;
}

function enrich(order: any) {
  const { meta, publicNotes } = parseNotes(order.notes);
  return { ...order, workflow: meta, publicNotes };
}

function getAvailability(order: any) {
  return order.items.map((it: any) => {
    const available = it.variantId ? it.variant?.stock : it.productId ? it.product?.stock : null;
    return {
      id: it.id,
      name: it.name,
      sku: it.sku,
      requested: it.qty,
      available,
      ok: available !== null && available >= it.qty,
    };
  });
}

async function syncOrderLead(order: any, status: "SCHEDULED" | "DELIVERED" | "LOST", reason: string) {
  try {
    await syncLeadStageByPhone(order?.customer?.phone, status, reason);
  } catch (error) {
    console.error("[CRM_STAGE_SYNC] Error", error);
  }
}

export async function GET() {
  const orders = await prisma.order.findMany({
    include: {
      customer: true,
      items: {
        include: {
          product: { select: { stock: true } },
          variant: { select: { stock: true } },
        },
      },
      history: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders.map(enrich));
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const body = await req.json();
    const { id, paymentStatus, shipStatus, guide, publicNotes, assignedSellerId, assignedSellerName, internalNote, action } = body;

    if (!id) return NextResponse.json({ error: "Pedido requerido" }, { status: 400 });

    if (action === "validate-stock") {
      const current = await prisma.order.findUnique({
        where: { id },
        include: {
          customer: true,
          items: { include: { product: { select: { stock: true } }, variant: { select: { stock: true } } } },
          history: { orderBy: { createdAt: "desc" } },
        },
      });
      if (!current) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

      const availability = getAvailability(current);
      const shortages = availability.filter((x: any) => !x.ok);
      const { meta, publicNotes: visible } = parseNotes(current.notes);

      if (shortages.length) {
        if (meta.stockValidated) {
          meta.stockValidated = false;
          await prisma.order.update({ where: { id }, data: { notes: buildNotes(meta, visible) } });
        }
        return NextResponse.json({ error: "Stock insuficiente o producto sin inventario vinculado", shortages, availability }, { status: 409 });
      }

      meta.stockValidated = true;
      const updated = await prisma.order.update({
        where: { id },
        data: {
          notes: buildNotes(meta, visible),
          history: { create: { action: "Stock validado", actor: "admin" } },
        },
        include: {
          customer: true,
          items: { include: { product: { select: { stock: true } }, variant: { select: { stock: true } } } },
          history: { orderBy: { createdAt: "desc" } },
        },
      });
      await writeAudit({ actorUserId: session.userId, actorName: session.name, action: "ORDER_STOCK_VALIDATED", meta: { orderId: id, orderNumber: updated.number } });
      return NextResponse.json({ ...enrich(updated), availability });
    }

    if (action === "confirm") {
      const confirmed = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(57392027)");
        const current = await tx.order.findUnique({
          where: { id },
          include: {
            customer: true,
            items: { include: { product: { select: { stock: true } }, variant: { select: { stock: true } } } },
            history: { orderBy: { createdAt: "desc" } },
          },
        });
        if (!current) throw new Error("NOT_FOUND");

        const parsed = parseNotes(current.notes);
        const meta = parsed.meta;
        const availability = getAvailability(current);
        const shortages = availability.filter((x: any) => !x.ok);

        if (!meta.inventoryApplied && shortages.length) {
          const err: any = new Error("STOCK_SHORTAGE");
          err.shortages = shortages;
          throw err;
        }

        if (!meta.inventoryApplied) {
          for (const it of current.items) {
            if (it.variantId) {
              await tx.variant.update({ where: { id: it.variantId }, data: { stock: { decrement: it.qty } } });
              await tx.stockMovement.create({
                data: { type: "SALE", qty: -it.qty, reason: `Reserva pedido ${current.number}`, productId: it.productId, variantId: it.variantId, actor: "admin" },
              });
            } else if (it.productId) {
              await tx.product.update({ where: { id: it.productId }, data: { stock: { decrement: it.qty } } });
              await tx.stockMovement.create({
                data: { type: "SALE", qty: -it.qty, reason: `Reserva pedido ${current.number}`, productId: it.productId, actor: "admin" },
              });
            }
          }
        }

        meta.stockValidated = true;
        meta.inventoryApplied = true;
        const updated = await tx.order.update({
          where: { id },
          data: {
            shipStatus: "APPROVED",
            notes: buildNotes(meta, parsed.publicNotes),
            history: { create: { action: "Pedido confirmado e inventario reservado", actor: "admin" } },
          },
          include: {
            customer: true,
            items: { include: { product: { select: { stock: true } }, variant: { select: { stock: true } } } },
            history: { orderBy: { createdAt: "desc" } },
          },
        });
        await tx.notification.create({
          data: { type: "order_confirmed", message: `Pedido ${current.number} confirmado` },
        });
        return updated;
      });

      await syncOrderLead(confirmed, "SCHEDULED", `Pedido ${confirmed.number} confirmado · lead movido automáticamente a Programado`);
      await writeAudit({ actorUserId: session.userId, actorName: session.name, action: "ORDER_CONFIRMED", meta: { orderId: id, orderNumber: confirmed.number, inventoryApplied: true } });
      return NextResponse.json(enrich(confirmed));
    }

    const current = await prisma.order.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });
    if (!current) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

    const parsed = parseNotes(current.notes);
    const meta = parsed.meta;
    const visible = publicNotes !== undefined ? String(publicNotes || "") : parsed.publicNotes;
    const data: any = {};
    const historyEntries: string[] = [];

    // Confirmado y las etapas posteriores sólo pueden alcanzarse después de reservar inventario.
    // La confirmación se hace exclusivamente con action="confirm" para evitar saltarse la validación de stock.
    if (shipStatus === "APPROVED" && !meta.inventoryApplied) {
      return NextResponse.json({ error: "Primero valida stock y confirma el pedido" }, { status: 409 });
    }
    if (["PREPARING", "SHIPPED", "DELIVERED"].includes(shipStatus) && !meta.inventoryApplied) {
      return NextResponse.json({ error: "El pedido debe estar confirmado antes de avanzar de etapa" }, { status: 409 });
    }

    if (paymentStatus) { data.paymentStatus = paymentStatus; historyEntries.push(`Pago: ${paymentStatus}`); }
    if (shipStatus) { data.shipStatus = shipStatus; historyEntries.push(`Estado: ${shipStatus}`); }
    if (guide !== undefined) { data.guide = guide; if (guide) historyEntries.push(`Guía: ${guide}`); }
    if (assignedSellerId !== undefined) {
      meta.assignedSellerId = assignedSellerId || null;
      meta.assignedSellerName = assignedSellerName || null;
      historyEntries.push(meta.assignedSellerName ? `Asignado a ${meta.assignedSellerName}` : "Pedido sin vendedor asignado");
    }
    if (internalNote !== undefined) meta.internalNote = String(internalNote || "");

    if (shipStatus === "CANCELLED" && meta.inventoryApplied) {
      const cancelled = await prisma.$transaction(async (tx) => {
        for (const it of current.items) {
          if (it.variantId) {
            await tx.variant.update({ where: { id: it.variantId }, data: { stock: { increment: it.qty } } });
            await tx.stockMovement.create({
              data: { type: "RETURN", qty: it.qty, reason: `Liberación pedido cancelado ${current.number}`, productId: it.productId, variantId: it.variantId, actor: "admin" },
            });
          } else if (it.productId) {
            await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.qty } } });
            await tx.stockMovement.create({
              data: { type: "RETURN", qty: it.qty, reason: `Liberación pedido cancelado ${current.number}`, productId: it.productId, actor: "admin" },
            });
          }
        }
        meta.inventoryApplied = false;
        meta.stockValidated = false;
        return tx.order.update({
          where: { id },
          data: {
            ...data,
            notes: buildNotes(meta, visible),
            history: { create: [...historyEntries, "Inventario liberado por cancelación"].map((entry) => ({ action: entry, actor: "admin" })) },
          },
          include: {
            customer: true,
            items: { include: { product: { select: { stock: true } }, variant: { select: { stock: true } } } },
            history: { orderBy: { createdAt: "desc" } },
          },
        });
      });
      await syncOrderLead(cancelled, "LOST", `Pedido ${cancelled.number} cancelado · lead movido automáticamente a Perdido`);
      await writeAudit({ actorUserId: session.userId, actorName: session.name, action: "ORDER_CANCELLED", meta: { orderId: id, orderNumber: cancelled.number, inventoryRestored: true } });
      return NextResponse.json(enrich(cancelled));
    }

    data.notes = buildNotes(meta, visible);
    const order = await prisma.order.update({
      where: { id },
      data: {
        ...data,
        history: historyEntries.length ? {
          create: historyEntries.map((entry) => ({ action: entry, actor: "admin" })),
        } : undefined,
      },
      include: {
        customer: true,
        items: { include: { product: { select: { stock: true } }, variant: { select: { stock: true } } } },
        history: { orderBy: { createdAt: "desc" } },
      },
    });

    if (shipStatus === "DELIVERED") {
      await syncOrderLead(order, "DELIVERED", `Pedido ${order.number} entregado · lead movido automáticamente a Entregado`);
    } else if (shipStatus === "CANCELLED") {
      await syncOrderLead(order, "LOST", `Pedido ${order.number} cancelado · lead movido automáticamente a Perdido`);
    }

    await writeAudit({ actorUserId: session.userId, actorName: session.name, action: "ORDER_UPDATED", meta: { orderId: id, orderNumber: order.number, changes: historyEntries } });
    return NextResponse.json(enrich(order));
  } catch (error: any) {
    if (error?.message === "NOT_FOUND") return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    if (error?.message === "STOCK_SHORTAGE") return NextResponse.json({ error: "Stock insuficiente", shortages: error.shortages || [] }, { status: 409 });
    console.error("Error actualizando pedido:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
