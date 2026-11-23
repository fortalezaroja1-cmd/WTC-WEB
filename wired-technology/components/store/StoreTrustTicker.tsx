"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

const messages = [
  "30% de descuento ya aplicado",
  "Paga en línea con iion pay",
  "Revisa tu pedido antes de pagar",
  "Envío cotizado según tu ciudad",
];

export function StoreTrustTicker() {
  const [manualPaused, setManualPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const paused = manualPaused || hovered;
  return <div className="store-ticker flex min-h-18 items-center gap-4 overflow-hidden bg-[#191919] px-4 text-white" aria-label="Información de compra">
    <button type="button" onClick={() => setManualPaused(value => !value)} aria-label={manualPaused ? "Reanudar mensajes" : "Pausar mensajes"} aria-pressed={manualPaused} className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/40 bg-[#191919] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
      {manualPaused ? <Play size={17} fill="currentColor" aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}
    </button>
    <div className="min-w-0 flex-1 overflow-hidden" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className={`store-ticker-track flex w-max items-center ${paused ? "store-ticker-paused" : ""}`}>
        {[...messages, ...messages].map((message, index) => <span key={`${message}-${index}`} aria-hidden={index >= messages.length} className="flex shrink-0 items-center gap-7 whitespace-nowrap px-5 text-sm font-semibold sm:px-8">
          <span aria-hidden="true" className="h-2 w-2 rotate-45 border border-white/45" />{message}
        </span>)}
      </div>
    </div>
  </div>;
}
