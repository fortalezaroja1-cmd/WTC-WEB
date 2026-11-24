// Server-only adapter. The token identifies Wired and never goes to the storefront.
export const centralStockEnabled = () =>
  process.env.TREFI_STOCK_MODE === "central";

export class TrefiStockError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export type StockLine = {
  productId?: string | null;
  variantId?: string | null;
  qty: number;
};
type Product = {
  id: string;
  stock: number;
  variants: { id: string; stock: number }[];
};
type ChannelOrder = {
  state: "reserved" | "cancelled" | "dispatched";
  lines: { id: string; quantity: number }[];
};
type Reply = {
  version?: string;
  available?: Record<string, number | null>;
  state?: string;
  order?: ChannelOrder | null;
};

export function offerId(line: Pick<StockLine, "variantId" | "productId">) {
  if (line.variantId) return "v:" + line.variantId;
  if (line.productId) return "p:" + line.productId;
  throw new TrefiStockError(
    "El pedido tiene una línea sin referencia de inventario.",
    409,
  );
}

async function requestStock(payload: Record<string, unknown>): Promise<Reply> {
  const url = process.env.TREFI_INVENTORY_URL,
    token = process.env.TREFI_INVENTORY_TOKEN;
  if (!url || !token)
    throw new TrefiStockError(
      "La disponibilidad está pendiente de verificación.",
      503,
    );
  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Inventory-Channel": "wired",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4500),
    });
    const result = await response.json();
    if (!response.ok)
      throw new TrefiStockError(
        response.status === 409
          ? result.error
          : "Trefi no pudo confirmar la disponibilidad.",
        response.status === 409 ? 409 : 503,
      );
    return result;
  } catch (error) {
    if (error instanceof TrefiStockError) throw error;
    throw new TrefiStockError(
      "No se pudo verificar el inventario en Trefi. Intenta de nuevo.",
      503,
    );
  }
}

export async function readAvailable(ids: string[]) {
  const unique = [...new Set(ids)],
    values: Record<string, number | null> = {};
  for (let n = 0; n < unique.length; n += 500) {
    const group = unique.slice(n, n + 500);
    const { available } = await requestStock({ action: "stock", ids: group });
    if (!available || typeof available !== "object")
      throw new TrefiStockError(
        "La respuesta de inventario está incompleta.",
        503,
      );
    for (const id of group) {
      const qty = available[id];
      if (
        qty !== null &&
        (typeof qty !== "number" || !Number.isSafeInteger(qty) || qty < 0)
      )
        throw new TrefiStockError(
          "La respuesta de inventario está incompleta.",
          503,
        );
      values[id] = qty;
    }
  }
  return values;
}

// Apply only to freshly queried product objects for the current request, never to the local database.
export async function applyStoreBalances(
  products: Product[],
  requireConnection = false,
) {
  if (!centralStockEnabled() || !products.length) return "ready";
  const targets = products.flatMap((p) =>
    p.variants.length
      ? p.variants.map((v) => ({ id: "v:" + v.id, row: v }))
      : [{ id: "p:" + p.id, row: p }],
  );
  let balances: Record<string, number | null> = {};
  let offline = false;
  try {
    balances = await readAvailable(targets.map((t) => t.id));
  } catch (error) {
    if (requireConnection) throw error;
    offline = true;
  }
  for (const target of targets) target.row.stock = balances[target.id] ?? 0;
  if (offline) return "offline";
  return targets.some((t) => balances[t.id] === null) ? "pending" : "ready";
}
export async function reserveInTrefi(order: string, items: StockLine[]) {
  const lines = items.map((it) => ({ id: offerId(it), quantity: it.qty }));
  const { state } = await requestStock({ action: "reserve", order, lines });
  if (state !== "reserved")
    throw new TrefiStockError("La orden no admite una nueva reserva.", 409);
}
export async function finishInTrefi(
  order: string,
  action: "dispatch" | "cancel",
) {
  const { state } = await requestStock({ action, order });
  if (state !== (action === "dispatch" ? "dispatched" : "cancelled"))
    throw new TrefiStockError("Trefi no confirmó el cambio de la orden.", 503);
}
export async function orderInTrefi(
  order: string,
): Promise<ChannelOrder | null> {
  const result = await requestStock({ action: "status", order });
  if (result.order === undefined)
    throw new TrefiStockError(
      "No se pudo verificar la reserva de este pedido.",
      503,
    );
  return result.order;
}

export async function stockVersion() {
  const { version } = await requestStock({ action: "version" });
  if (typeof version !== "string" || !/^[0-9a-f]{32}$/.test(version)) {
    throw new TrefiStockError(
      "No se pudo verificar la versión de inventario.",
      503,
    );
  }
  return version;
}
