"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Filter,
  GripVertical,
  MapPin,
  MessageCircle,
  PackageCheck,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { formatCOP, timeAgo, waLink } from "@/lib/utils";

const STAGES = [
  { id: "PENDING_PAYMENT", label: "Nuevo", hint: "Sin revisar" },
  { id: "READY", label: "Revisado", hint: "Validar y contactar" },
  { id: "APPROVED", label: "Confirmado", hint: "Stock reservado" },
  { id: "PREPARING", label: "Preparando", hint: "En alistamiento" },
  { id: "SHIPPED", label: "Despachado", hint: "En transporte" },
  { id: "DELIVERED", label: "Entregado", hint: "Venta cerrada" },
  { id: "CANCELLED", label: "Cancelado", hint: "No concretado" },
] as const;

const OPEN_STAGES = new Set(["PENDING_PAYMENT", "READY", "APPROVED", "PREPARING", "SHIPPED"]);

export default function CrmPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sellerFilter, setSellerFilter] = useState("ALL");
  const [dragging, setDragging] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<any[] | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/orders", { cache: "no-store" });
    if (res.ok) setOrders(await res.json());
  };

  useEffect(() => {
    load();
    fetch("/api/admin/sales-users", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSellers)
      .catch(() => setSellers([]));
  }, []);

  const current = useMemo(() => orders.find((o) => o.id === selected), [orders, selected]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (sellerFilter === "UNASSIGNED" && o.workflow?.assignedSellerId) return false;
      if (sellerFilter !== "ALL" && sellerFilter !== "UNASSIGNED" && o.workflow?.assignedSellerId !== sellerFilter) return false;
      if (!text) return true;
      const haystack = [
        o.number,
        o.customer?.name,
        o.customer?.phone,
        o.customer?.city,
        o.workflow?.assignedSellerName,
        o.workflow?.origin,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(text);
    });
  }, [orders, query, sellerFilter]);

  const openOrders = filtered.filter((o) => OPEN_STAGES.has(o.shipStatus));
  const pipelineValue = openOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const deliveredValue = filtered.filter((o) => o.shipStatus === "DELIVERED").reduce((sum, o) => sum + Number(o.total || 0), 0);
  const newCount = filtered.filter((o) => o.shipStatus === "PENDING_PAYMENT").length;
  const unassigned = filtered.filter((o) => OPEN_STAGES.has(o.shipStatus) && !o.workflow?.assignedSellerId).length;

  const requestUpdate = async (id: string, data: any) => {
    const res = await fetch("/api/admin/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    const payload = await res.json();
    if (!res.ok) {
      const err: any = new Error(payload.error || "No se pudo actualizar");
      err.payload = payload;
      throw err;
    }
    await load();
    return payload;
  };

  const moveOrder = async (order: any, target: string) => {
    if (!order || order.shipStatus === target || busy) return;
    setBusy(order.id);
    setError("");
    setAvailability(null);
    try {
      if (target === "APPROVED") {
        await requestUpdate(order.id, { action: "validate-stock" });
        await requestUpdate(order.id, { action: "confirm" });
      } else if (["PREPARING", "SHIPPED", "DELIVERED"].includes(target) && !order.workflow?.inventoryApplied) {
        throw new Error("Primero debes validar stock y confirmar el pedido.");
      } else {
        await requestUpdate(order.id, { shipStatus: target });
      }
    } catch (e: any) {
      setError(e.message);
      setAvailability(e.payload?.availability || e.payload?.shortages || null);
    } finally {
      setBusy("");
      setDragging(null);
    }
  };

  const assignSeller = async (order: any, sellerId: string) => {
    const seller = sellers.find((s) => s.id === sellerId);
    setBusy(order.id);
    setError("");
    try {
      await requestUpdate(order.id, {
        assignedSellerId: seller?.id || "",
        assignedSellerName: seller?.name || "",
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const validateStock = async (order: any) => {
    setBusy(order.id);
    setError("");
    setAvailability(null);
    try {
      const data = await requestUpdate(order.id, { action: "validate-stock" });
      setAvailability(data.availability || []);
    } catch (e: any) {
      setError(e.message);
      setAvailability(e.payload?.availability || e.payload?.shortages || []);
    } finally {
      setBusy("");
    }
  };

  const confirmOrder = async (order: any) => {
    setBusy(order.id);
    setError("");
    try {
      await requestUpdate(order.id, { action: "confirm" });
      setAvailability(null);
    } catch (e: any) {
      setError(e.message);
      setAvailability(e.payload?.shortages || []);
    } finally {
      setBusy("");
    }
  };

  const nextStage = current ? STAGES.findIndex((s) => s.id === current.shipStatus) : -1;
  const suggestedNext = nextStage >= 0 && nextStage < STAGES.length - 1 ? STAGES[nextStage + 1] : null;

  return (
    <div className="min-w-0">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">CRM de ventas</h1>
            <span className="font-mono text-[9px] tracking-wider uppercase bg-copper/10 text-copper px-2 py-1 rounded-full">Pipeline</span>
          </div>
          <p className="text-sm text-muted mt-1">Gestiona cada pedido visualmente desde que entra hasta que se entrega.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente, pedido, ciudad..."
              className="w-full sm:w-[270px] bg-white border border-hair rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-copper"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="w-full sm:w-[190px] bg-white border border-hair rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-copper"
            >
              <option value="ALL">Todos los vendedores</option>
              <option value="UNASSIGNED">Sin asignar</option>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <Metric icon={CircleDollarSign} label="Pipeline abierto" value={formatCOP(pipelineValue)} helper={`${openOrders.length} oportunidades`} />
        <Metric icon={ShoppingBag} label="Pedidos nuevos" value={String(newCount)} helper="Pendientes por revisar" />
        <Metric icon={UserRound} label="Sin responsable" value={String(unassigned)} helper="Requieren asignación" warning={unassigned > 0} />
        <Metric icon={CheckCircle2} label="Entregado" value={formatCOP(deliveredValue)} helper="Ventas cerradas visibles" />
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 border border-red-100 bg-red-50 text-alert rounded-lg px-4 py-3 text-sm">
          <AlertTriangle size={17} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold">No se pudo mover la oportunidad</div>
            <div className="text-xs mt-0.5">{error}</div>
          </div>
          <button onClick={() => setError("")}><X size={16} /></button>
        </div>
      )}

      <div className="overflow-x-auto pb-4 -mx-2 px-2">
        <div className="flex gap-3 min-w-max items-start">
          {STAGES.map((stage) => {
            const stageOrders = filtered.filter((o) => o.shipStatus === stage.id);
            const value = stageOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
            return (
              <section
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const order = orders.find((o) => o.id === dragging);
                  if (order) moveOrder(order, stage.id);
                }}
                className={`w-[292px] rounded-xl border bg-[#ECEEF1] transition-colors ${dragging ? "border-copper/40" : "border-hair"}`}
              >
                <div className="px-3.5 py-3 border-b border-hair bg-white rounded-t-xl sticky top-0 z-[1]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-copper shrink-0" />
                      <div className="font-semibold text-sm truncate">{stage.label}</div>
                      <span className="text-[10px] min-w-5 h-5 px-1.5 rounded-full bg-paper text-muted flex items-center justify-center font-mono">{stageOrders.length}</span>
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-muted whitespace-nowrap">{formatCOP(value)}</div>
                  </div>
                  <div className="text-[10px] text-muted mt-1 ml-[18px]">{stage.hint}</div>
                </div>

                <div className="p-2.5 min-h-[180px] space-y-2.5">
                  {stageOrders.length === 0 && (
                    <div className="border border-dashed border-[#D0D5DB] rounded-lg px-3 py-8 text-center text-[11px] text-muted">
                      Arrastra una oportunidad aquí
                    </div>
                  )}
                  {stageOrders.map((order) => (
                    <article
                      key={order.id}
                      draggable={!busy}
                      onDragStart={() => setDragging(order.id)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => { setSelected(order.id); setError(""); setAvailability(null); }}
                      className={`bg-white rounded-lg border p-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                        dragging === order.id ? "opacity-40 border-copper" : "border-hair"
                      } ${busy === order.id ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical size={14} className="text-[#B4BAC2] shrink-0 mt-0.5 cursor-grab" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-[13px] leading-tight truncate">{order.customer?.name || "Cliente sin nombre"}</div>
                            <div className="font-mono text-[9px] text-muted whitespace-nowrap">{order.number}</div>
                          </div>
                          <div className="font-display text-[15px] font-bold mt-2">{formatCOP(Number(order.total))}</div>
                          <div className="flex items-center gap-1 text-[10px] text-muted mt-2">
                            <MapPin size={11} /> <span className="truncate">{order.customer?.city || "Sin ciudad"}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 border-t border-hair pt-2">
                            <div className={`text-[10px] truncate ${order.workflow?.assignedSellerName ? "text-slate-dark" : "text-alert font-semibold"}`}>
                              {order.workflow?.assignedSellerName || "Sin asignar"}
                            </div>
                            <div className="text-[9px] text-muted whitespace-nowrap">{timeAgo(order.createdAt)}</div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[9px] bg-paper rounded-full px-2 py-1 text-muted">{order.workflow?.origin || "Web"}</span>
                            {order.workflow?.stockValidated && !order.workflow?.inventoryApplied && (
                              <span className="text-[9px] bg-green-50 rounded-full px-2 py-1 text-green font-semibold">Stock OK</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-hair pt-4 mt-1 text-xs text-muted">
        <span>Arrastra las tarjetas entre etapas. Confirmar ejecuta validación de stock antes de reservar inventario.</span>
        <Link href="/admin/pedidos" className="text-copper font-semibold inline-flex items-center gap-1 hover:underline">Ver tabla de pedidos <ChevronRight size={13}/></Link>
      </div>

      {current && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <aside className="w-[500px] max-w-[96vw] h-full bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 border-b border-hair p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] text-copper font-semibold tracking-wider">{current.number}</div>
                  <h2 className="font-display text-xl font-bold mt-1">{current.customer?.name || "Cliente"}</h2>
                  <div className="text-xs text-muted mt-1">{current.customer?.city || "Sin ciudad"} · {current.workflow?.origin || "Web"}</div>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 hover:bg-paper rounded-lg"><X size={19}/></button>
              </div>
              <div className="mt-4 bg-paper rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">Valor</div>
                  <div className="font-display text-xl font-bold">{formatCOP(Number(current.total))}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted uppercase tracking-wider">Etapa</div>
                  <div className="text-sm font-semibold">{STAGES.find((s) => s.id === current.shipStatus)?.label || current.shipStatus}</div>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {error && (
                <div className="flex gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-alert">
                  <AlertTriangle size={17} className="shrink-0" /> {error}
                </div>
              )}

              <section>
                <div className="text-[10px] uppercase tracking-[.14em] font-semibold text-muted mb-2">Contacto</div>
                <div className="text-sm font-medium">{current.customer?.phone || "Sin teléfono"}</div>
                <div className="text-xs text-muted mt-1">{current.customer?.address || "Sin dirección"}{current.customer?.city ? `, ${current.customer.city}` : ""}</div>
                {current.customer?.phone && (
                  <a
                    href={waLink(current.customer.phone, `Hola ${current.customer?.name || ""}, te escribimos de Wired Technology sobre tu pedido ${current.number}. Estamos revisando disponibilidad y entrega. Recuerda que puedes pagar en casa al recibir.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 bg-green text-white px-3 py-2 rounded-lg text-xs font-semibold"
                  >
                    <MessageCircle size={14}/> WhatsApp
                  </a>
                )}
              </section>

              <section>
                <label className="text-[10px] uppercase tracking-[.14em] font-semibold text-muted block mb-2">Responsable</label>
                <select
                  value={current.workflow?.assignedSellerId || ""}
                  onChange={(e) => assignSeller(current, e.target.value)}
                  disabled={busy === current.id}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper ${current.workflow?.assignedSellerId ? "border-hair" : "border-alert"}`}
                >
                  <option value="">Sin asignar</option>
                  {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </section>

              <section>
                <div className="text-[10px] uppercase tracking-[.14em] font-semibold text-muted mb-2">Productos</div>
                <div className="border border-hair rounded-lg overflow-hidden">
                  {current.items.map((it: any) => (
                    <div key={it.id} className="flex justify-between gap-3 px-3 py-2.5 border-b border-hair last:border-b-0 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-[10px] font-mono text-muted mt-0.5">{it.qty} × {formatCOP(Number(it.unitPrice))}</div>
                      </div>
                      <div className="font-semibold whitespace-nowrap">{formatCOP(Number(it.total))}</div>
                    </div>
                  ))}
                </div>
              </section>

              {availability && (
                <section className="bg-paper rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-[.14em] font-semibold text-muted mb-2">Validación de stock</div>
                  {availability.map((x: any, i: number) => (
                    <div key={x.id || i} className={`text-xs py-1 ${x.ok ? "text-green" : "text-alert"}`}>
                      {x.name}: solicita {x.requested}, disponible {x.available ?? "—"}
                    </div>
                  ))}
                </section>
              )}

              {!current.workflow?.inventoryApplied && current.shipStatus !== "CANCELLED" && current.shipStatus !== "DELIVERED" && (
                <section>
                  <div className="text-[10px] uppercase tracking-[.14em] font-semibold text-muted mb-2">Cierre operativo</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => validateStock(current)}
                      disabled={busy === current.id}
                      className="border border-hair rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-copper disabled:opacity-50"
                    >
                      <PackageCheck size={15}/> Validar stock
                    </button>
                    <button
                      onClick={() => confirmOrder(current)}
                      disabled={busy === current.id || !current.workflow?.stockValidated}
                      className="bg-copper text-white rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <CheckCircle2 size={15}/> Confirmar
                    </button>
                  </div>
                  {!current.workflow?.stockValidated && <p className="text-[10px] text-muted mt-2">Primero valida disponibilidad. Confirmar reserva el inventario.</p>}
                </section>
              )}

              {suggestedNext && current.workflow?.inventoryApplied && !["DELIVERED", "CANCELLED"].includes(current.shipStatus) && (
                <button
                  onClick={() => moveOrder(current, suggestedNext.id)}
                  disabled={busy === current.id}
                  className="w-full bg-graphite text-white rounded-lg py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Mover a {suggestedNext.label} <ChevronRight size={16}/>
                </button>
              )}

              {current.shipStatus === "PENDING_PAYMENT" && (
                <button
                  onClick={() => moveOrder(current, "READY")}
                  disabled={busy === current.id}
                  className="w-full bg-graphite text-white rounded-lg py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  Marcar como revisado <ChevronRight size={16}/>
                </button>
              )}

              <section>
                <label className="text-[10px] uppercase tracking-[.14em] font-semibold text-muted block mb-2">Nota interna</label>
                <textarea
                  key={`${current.id}-${current.workflow?.internalNote || ""}`}
                  defaultValue={current.workflow?.internalNote || ""}
                  onBlur={(e) => requestUpdate(current.id, { internalNote: e.target.value }).catch((err) => setError(err.message))}
                  rows={3}
                  placeholder="Notas para el vendedor..."
                  className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper resize-none"
                />
              </section>

              <div className="flex gap-2 pt-2 border-t border-hair">
                <Link href="/admin/pedidos" className="flex-1 border border-hair rounded-lg py-2.5 text-xs font-semibold text-center hover:border-copper">Abrir en pedidos</Link>
                {current.shipStatus !== "CANCELLED" && current.shipStatus !== "DELIVERED" && (
                  <button onClick={() => moveOrder(current, "CANCELLED")} className="px-4 border border-red-100 text-alert rounded-lg text-xs font-semibold hover:bg-red-50">Cancelar</button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, helper, warning = false }: any) {
  return (
    <div className="bg-white border border-hair rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${warning ? "bg-red-50 text-alert" : "bg-paper text-slate-dark"}`}>
        <Icon size={17}/>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[.12em] font-semibold text-muted truncate">{label}</div>
        <div className="font-display text-lg font-bold mt-0.5 truncate">{value}</div>
        <div className="text-[10px] text-muted mt-0.5 truncate">{helper}</div>
      </div>
    </div>
  );
}
