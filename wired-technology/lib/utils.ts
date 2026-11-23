import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCOP(n: number | string | null | undefined): string {
  return "$ " + new Intl.NumberFormat("es-CO").format(Math.round(Number(n) || 0));
}

export const IVA_RATE = 0.19;

// Los precios guardados en el catálogo son valores antes de IVA. Todo precio
// público y todo cobro se calculan desde esta función para evitar diferencias.
export function getPublicPrice(netPrice: number | string | null | undefined) {
  const net = Math.max(0, Number(netPrice) || 0);
  return Math.round(net * (1 + IVA_RATE));
}

export function getDiscountPricing(currentPrice: number | string | null | undefined) {
  const current = getPublicPrice(currentPrice);
  const original = current > 0 ? Math.round(current / 0.7) : 0;

  return {
    current,
    original,
    savings: Math.max(0, original - current),
    discountPercent: 30,
  };
}

export function generateOrderNumber(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `WT-${num}`;
}

export function timeAgo(date: Date | string): string {
  const h = Math.round((Date.now() - new Date(date).getTime()) / 36e5);
  if (h < 1) return "hace min.";
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.round(h / 24)}d`;
}

export function waLink(phone: string, msg: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  const normalized = digits.length === 10 ? `57${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
}

// Reutilizamos el enum existente de Prisma para no exigir una migración.
// El orden de esta lista representa el flujo comercial real del pedido.
export const SHIP_STATUSES = [
  "PENDING_PAYMENT", // Nuevo
  "READY",           // Revisado
  "APPROVED",        // Confirmado
  "PREPARING",       // Preparando
  "SHIPPED",         // Despachado
  "DELIVERED",       // Entregado
  "CANCELLED",       // Cancelado
] as const;

export const SHIP_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Nuevo",
  READY: "Revisado",
  APPROVED: "Confirmado",
  PREPARING: "Preparando",
  SHIPPED: "Despachado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

export const PAY_LABELS: Record<string, string> = {
  PENDING: "Pendiente / contraentrega",
  APPROVED: "Pago aprobado",
  REJECTED: "Pago rechazado",
  REFUNDED: "Reembolsado",
};

