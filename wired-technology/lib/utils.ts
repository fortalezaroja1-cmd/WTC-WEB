import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCOP(n: number | string | null | undefined): string {
  return "$ " + new Intl.NumberFormat("es-CO").format(Math.round(Number(n) || 0));
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
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export const SHIP_STATUSES = [
  "PENDING_PAYMENT", "APPROVED", "PREPARING", "READY",
  "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED",
] as const;

export const SHIP_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  APPROVED: "Pago aprobado",
  PREPARING: "Preparando pedido",
  READY: "Listo para enviar",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

export const PAY_LABELS: Record<string, string> = {
  PENDING: "Pendiente de pago",
  APPROVED: "Pago aprobado",
  REJECTED: "Pago rechazado",
  REFUNDED: "Reembolsado",
};
