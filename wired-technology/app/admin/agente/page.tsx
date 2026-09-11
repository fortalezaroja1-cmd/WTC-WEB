"use client";

import { useMemo, useState } from "react";
import { Bot, RotateCcw, Send, ShieldCheck } from "lucide-react";

type AgentState = Record<string, unknown>;
type Turn = { role: "user" | "agent"; text: string };

type Decision = {
  reply: string;
  status: string;
  intent: string;
  confidence: number;
  needsHuman: boolean;
  cap: string;
  state: AgentState;
  action: string;
  matchedProduct?: {
    productName?: string;
    variantName?: string | null;
    sku?: string;
    price?: number | null;
    stock?: number;
    unit?: string;
    score?: number;
  } | null;
};

export default function AgentTestPage() {
  const [message, setMessage] = useState("Hola, necesito 5 rollos de cable #12 para Medellín");
  const [state, setState] = useState<AgentState>({});
  const [turns, setTurns] = useState<Turn[]>([]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confidence = useMemo(() => decision ? `${Math.round((decision.confidence || 0) * 100)}%` : "—", [decision]);

  const run = async () => {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, state }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "No se pudo ejecutar la prueba");
      const next: Decision = payload.decision;
      setDecision(next);
      setState(next.state || {});
      setTurns((prev) => [...prev, { role: "user", text }, { role: "agent", text: next.reply }]);
      setMessage("");
    } catch (e: any) {
      setError(e?.message || "No se pudo ejecutar la prueba");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setState({});
    setTurns([]);
    setDecision(null);
    setError("");
    setMessage("Hola, necesito 5 rollos de cable #12 para Medellín");
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Bot size={22} className="text-copper" />
            <h1 className="font-display text-2xl font-bold">Probar agente</h1>
          </div>
          <p className="text-sm text-muted mt-1">Simula conversaciones usando el catálogo real, sin enviar WhatsApp ni modificar leads.</p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs border border-green-200 bg-green-50 text-green-700 rounded-lg px-3 py-2">
          <ShieldCheck size={15} /> Modo seguro · solo lectura
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_.65fr] gap-5">
        <section className="bg-white border border-hair rounded-xl overflow-hidden min-h-[640px] flex flex-col">
          <div className="border-b border-hair px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Conversación de prueba</div>
              <div className="text-xs text-muted mt-0.5">Puedes enviar varios mensajes seguidos; el estado se conserva entre turnos.</div>
            </div>
            <button onClick={reset} className="inline-flex items-center gap-2 border border-hair rounded-lg px-3 py-2 text-xs font-semibold hover:border-copper">
              <RotateCcw size={14} /> Reiniciar
            </button>
          </div>

          <div className="flex-1 p-5 space-y-3 bg-[#F7F8FA] overflow-y-auto">
            {turns.length === 0 && (
              <div className="h-full min-h-[390px] flex items-center justify-center">
                <div className="max-w-md text-center text-sm text-muted">
                  Escribe como lo haría un cliente. Ejemplo: “Necesito 5 rollos de cable #12 para Medellín”.
                </div>
              </div>
            )}
            {turns.map((turn, index) => (
              <div key={index} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${turn.role === "user" ? "bg-graphite text-white rounded-br-md" : "bg-white border border-hair text-slate-dark rounded-bl-md"}`}>
                  {turn.text}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-hair p-4 bg-white">
            {error && <div className="mb-3 text-xs text-alert bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    run();
                  }
                }}
                rows={3}
                placeholder="Escribe un mensaje de cliente..."
                className="flex-1 resize-none bg-white border border-hair rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-copper"
              />
              <button onClick={run} disabled={busy || !message.trim()} className="self-end inline-flex items-center gap-2 bg-copper text-white rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50">
                <Send size={15} /> {busy ? "Probando..." : "Enviar"}
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white border border-hair rounded-xl p-5">
            <div className="font-semibold mb-4">Lectura del agente</div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Intención" value={decision?.intent || "—"} />
              <Metric label="Acción" value={decision?.action || "—"} />
              <Metric label="Estado CRM" value={decision?.status || "—"} />
              <Metric label="CAP" value={decision?.cap || "—"} />
              <Metric label="Confianza" value={confidence} />
              <Metric label="Escalar" value={decision ? (decision.needsHuman ? "Sí" : "No") : "—"} />
            </div>
          </div>

          <div className="bg-white border border-hair rounded-xl p-5">
            <div className="font-semibold mb-3">Producto detectado</div>
            {decision?.matchedProduct ? (
              <div className="space-y-2 text-sm">
                <Row label="Producto" value={decision.matchedProduct.productName || "—"} />
                <Row label="Variante" value={decision.matchedProduct.variantName || "—"} />
                <Row label="SKU" value={decision.matchedProduct.sku || "—"} />
                <Row label="Precio" value={decision.matchedProduct.price != null ? Number(decision.matchedProduct.price).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }) : "—"} />
                <Row label="Stock" value={decision.matchedProduct.stock != null ? String(decision.matchedProduct.stock) : "—"} />
              </div>
            ) : (
              <div className="text-sm text-muted">Aún no se detecta un producto concreto.</div>
            )}
          </div>

          <div className="bg-white border border-hair rounded-xl p-5">
            <div className="font-semibold mb-3">Estado acumulado</div>
            <pre className="text-[11px] leading-relaxed bg-[#F7F8FA] border border-hair rounded-lg p-3 overflow-auto max-h-[300px]">{JSON.stringify(state, null, 2)}</pre>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-hair rounded-lg p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-semibold text-sm mt-1 truncate" title={value}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-hair last:border-0 pb-2 last:pb-0">
      <span className="text-muted text-xs">{label}</span>
      <span className="font-medium text-xs text-right break-all">{value}</span>
    </div>
  );
}
