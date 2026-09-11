"use client";
import { useEffect, useMemo, useState } from "react";
import { formatCOP, PAY_LABELS, SHIP_LABELS, SHIP_STATUSES, waLink } from "@/lib/utils";
import { X, MessageCircle, PackageCheck, CheckCircle2, AlertTriangle, UserRound, Tag } from "lucide-react";

export default function PedidosAdmin() {
  const [orders, setOrders] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [availability, setAvailability] = useState<any[] | null>(null);
  const [busy, setBusy] = useState("");

  const loadOrders = async () => {
    const res = await fetch("/api/admin/orders", { cache: "no-store" });
    if (res.ok) setOrders(await res.json());
  };

  useEffect(() => {
    loadOrders();
    fetch("/api/admin/sales-users", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then(setSellers)
      .catch(() => setSellers([]));
  }, []);

  const cur = useMemo(() => orders.find((o) => o.id === selected), [orders, selected]);

  const requestUpdate = async (id: string, data: any) => {
    const res = await fetch("/api/admin/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    const payload = await res.json();
    if (!res.ok) {
      const err: any = new Error(payload.error || "No se pudo actualizar el pedido");
      err.payload = payload;
      throw err;
    }
    await loadOrders();
    return payload;
  };

  const openOrder = async (order: any) => {
    setSelected(order.id);
    setActionError("");
    setAvailability(null);
    if (order.shipStatus === "PENDING_PAYMENT") {
      try { await requestUpdate(order.id, { shipStatus: "READY" }); } catch {}
    }
  };

  const validateStock = async () => {
    if (!cur) return;
    setBusy("stock");
    setActionError("");
    try {
      const data = await requestUpdate(cur.id, { action: "validate-stock" });
      setAvailability(data.availability || []);
    } catch (e: any) {
      setAvailability(e.payload?.availability || e.payload?.shortages || []);
      setActionError(e.message);
    } finally {
      setBusy("");
    }
  };

  const confirmOrder = async () => {
    if (!cur) return;
    setBusy("confirm");
    setActionError("");
    try {
      await requestUpdate(cur.id, { action: "confirm" });
      setAvailability(null);
    } catch (e: any) {
      setAvailability(e.payload?.shortages || []);
      setActionError(e.message);
    } finally {
      setBusy("");
    }
  };

  const assignSeller = async (sellerId: string) => {
    if (!cur) return;
    const seller = sellers.find((s) => s.id === sellerId);
    try {
      await requestUpdate(cur.id, {
        assignedSellerId: seller?.id || "",
        assignedSellerName: seller?.name || "",
      });
    } catch (e: any) { setActionError(e.message); }
  };

  const newCount = orders.filter((o) => o.shipStatus === "PENDING_PAYMENT").length;

  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold">Pedidos</h1>
          <p className="text-xs text-muted mt-1">{newCount ? `${newCount} pedido${newCount === 1 ? "" : "s"} nuevo${newCount === 1 ? "" : "s"} por revisar` : "No hay pedidos nuevos pendientes"}</p>
        </div>
      </div>

      <div className="bg-card border border-hair rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="border-b border-hair">
            {["Pedido", "Fecha", "Cliente", "Responsable", "Origen", "Total", "Estado", ""].map((h) => (
              <th key={h} className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2.5">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className={`border-b border-hair hover:bg-paper/50 ${o.shipStatus === "PENDING_PAYMENT" ? "bg-amber-50/40" : ""}`}>
                <td className="px-4 py-3">
                  <div className="font-mono font-bold">{o.number}</div>
                  {o.shipStatus === "PENDING_PAYMENT" && <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-700">Nuevo</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{new Date(o.createdAt).toLocaleDateString("es-CO")}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{o.customer?.name || "—"}</div>
                  <div className="font-mono text-[10px] text-muted">{o.customer?.city}</div>
                </td>
                <td className="px-4 py-3">
                  {o.workflow?.assignedSellerName ? (
                    <span className="text-xs font-medium">{o.workflow.assignedSellerName}</span>
                  ) : (
                    <span className="text-xs font-semibold text-alert">Sin asignar</span>
                  )}
                </td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-paper">{o.workflow?.origin || "Web"}</span></td>
                <td className="px-4 py-3 font-display font-semibold">{formatCOP(Number(o.total))}</td>
                <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-1 rounded-full bg-paper text-slate-dark">{SHIP_LABELS[o.shipStatus] || o.shipStatus}</span></td>
                <td className="px-4 py-3"><button onClick={() => openOrder(o)} className="text-xs font-semibold border border-hair px-3 py-1.5 rounded-lg hover:border-copper transition-colors">Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cur && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-[520px] max-w-[96vw] bg-white h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-hair sticky top-0 bg-white z-10">
              <div>
                <span className="font-display font-bold">Pedido {cur.number}</span>
                <div className="font-mono text-[10px] text-muted mt-0.5">Origen: {cur.workflow?.origin || "Web"}</div>
              </div>
              <button onClick={() => setSelected(null)}><X size={20} /></button>
            </div>

            <div className="p-5 space-y-6">
              {actionError && (
                <div className="flex gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-alert">
                  <AlertTriangle size={17} className="shrink-0" /> {actionError}
                </div>
              )}

              <section>
                <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-2">Cliente</div>
                <div className="text-sm font-semibold">{cur.customer?.name}</div>
                <div className="font-mono text-xs text-muted">{cur.customer?.phone}{cur.customer?.email ? ` · ${cur.customer.email}` : ""}</div>
                <div className="text-xs mt-1">{cur.customer?.address}, {cur.customer?.city}</div>
                {cur.customer?.phone && (
                  <a
                    href={waLink(cur.customer.phone, `Hola ${cur.customer?.name || ""}, recibimos tu pedido ${cur.number}. Estamos validando disponibilidad y entrega. Recuerda que puedes pagar en casa al recibir.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-green text-white text-xs font-semibold px-3 py-2 rounded-lg mt-3 hover:opacity-90"
                  >
                    <MessageCircle size={14} /> Escribir por WhatsApp
                  </a>
                )}
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-dark flex items-center gap-1 mb-1"><UserRound size={13}/> Responsable</label>
                  <select
                    value={cur.workflow?.assignedSellerId || ""}
                    onChange={(e) => assignSeller(e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-copper ${cur.workflow?.assignedSellerId ? "border-hair" : "border-alert"}`}
                  >
                    <option value="">Sin asignar</option>
                    {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-dark flex items-center gap-1 mb-1"><Tag size={13}/> Estado</label>
                  <select
                    value={cur.shipStatus}
                    onChange={(e) => requestUpdate(cur.id, { shipStatus: e.target.value }).catch((err) => setActionError(err.message))}
                    className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-copper"
                  >
                    {SHIP_STATUSES.map((s) => <option key={s} value={s}>{SHIP_LABELS[s]}</option>)}
                  </select>
                </div>
              </section>

              <section>
                <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-2">Productos y stock</div>
                {cur.items.map((it: any) => {
                  const currentStock = it.variantId ? it.variant?.stock : it.product?.stock;
                  const ok = typeof currentStock === "number" && currentStock >= it.qty;
                  return (
                    <div key={it.id} className="flex justify-between gap-3 py-2.5 border-b border-hair text-sm">
                      <div>
                        <div className="font-medium">{it.name}</div>
                        <div className="font-mono text-[10px] text-muted">{it.sku} · Pedido: {it.qty} · Stock: {currentStock ?? "sin vínculo"}</div>
                        <div className={`text-[10px] font-semibold mt-0.5 ${ok ? "text-green" : "text-alert"}`}>{ok ? "Disponible" : "Revisar disponibilidad"}</div>
                      </div>
                      <span className="font-display font-semibold whitespace-nowrap">{formatCOP(Number(it.total))}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between font-bold pt-3"><span>Total</span><span className="font-display text-copper">{formatCOP(Number(cur.total))}</span></div>

                {availability && (
                  <div className="mt-3 bg-paper rounded-lg p-3 text-xs">
                    {availability.map((x: any, i: number) => (
                      <div key={x.id || i} className={x.ok ? "text-green" : "text-alert"}>
                        {x.name}: solicita {x.requested}, disponible {x.available ?? "—"}
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={validateStock}
                    disabled={!!busy || cur.workflow?.inventoryApplied}
                    className="border border-hair rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-copper disabled:opacity-50"
                  >
                    <PackageCheck size={15}/> {busy === "stock" ? "Validando..." : "Validar stock"}
                  </button>
                  <button
                    onClick={confirmOrder}
                    disabled={!!busy || cur.workflow?.inventoryApplied || !cur.workflow?.stockValidated}
                    className="bg-copper text-white rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <CheckCircle2 size={15}/> {cur.workflow?.inventoryApplied ? "Confirmado" : busy === "confirm" ? "Confirmando..." : "Confirmar pedido"}
                  </button>
                </div>
                {!cur.workflow?.stockValidated && !cur.workflow?.inventoryApplied && (
                  <p className="text-[10px] text-muted mt-2">Primero valida el stock. Al confirmar se reserva/descuenta el inventario una sola vez.</p>
                )}
              </section>

              <section>
                <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-2">Información del pedido</div>
                {cur.publicNotes ? <pre className="text-xs whitespace-pre-wrap font-sans bg-paper rounded-lg p-3">{cur.publicNotes}</pre> : <p className="text-xs text-muted">Sin observaciones del cliente.</p>}
              </section>

              <section>
                <label className="text-xs font-semibold text-slate-dark block mb-1">Nota interna del vendedor</label>
                <textarea
                  key={`${cur.id}-${cur.workflow?.internalNote || ""}`}
                  defaultValue={cur.workflow?.internalNote || ""}
                  onBlur={(e) => requestUpdate(cur.id, { internalNote: e.target.value }).catch((err) => setActionError(err.message))}
                  rows={3}
                  placeholder="Ej: cliente recurrente, llamar después de las 3 p. m., confirmar color..."
                  className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-copper resize-none"
                />
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-dark block mb-1">Estado del pago</label>
                  <select value={cur.paymentStatus} onChange={(e) => requestUpdate(cur.id, { paymentStatus: e.target.value }).catch((err) => setActionError(err.message))}
                    className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-copper">
                    {["PENDING", "APPROVED", "REJECTED", "REFUNDED"].map((s) => <option key={s} value={s}>{PAY_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-dark block mb-1">Número de guía</label>
                  <input
                    defaultValue={cur.guide || ""}
                    onBlur={(e) => requestUpdate(cur.id, { guide: e.target.value }).catch((err) => setActionError(err.message))}
                    placeholder="TCC / Servientrega…"
                    className="w-full border border-hair rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-copper"
                  />
                </div>
              </section>

              <section>
                <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-2">Historial</div>
                <div className="space-y-2">
                  {cur.history?.slice(0, 8).map((h: any) => (
                    <div key={h.id} className="text-xs border-l-2 border-hair pl-3">
                      <div>{h.action}</div>
                      <div className="font-mono text-[9px] text-muted">{new Date(h.createdAt).toLocaleString("es-CO")}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
