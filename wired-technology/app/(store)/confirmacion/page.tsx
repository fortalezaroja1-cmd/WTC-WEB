"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";

function ConfirmationContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order") || "—";

  return (
    <div className="max-w-[560px] mx-auto px-5 py-16">
      <div className="bg-card border border-hair rounded-xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-green" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-1">¡Pedido recibido!</h1>
        <p className="font-mono text-sm text-muted mb-5">{orderNumber}</p>
        <p className="text-sm text-slate-dark mb-5">
          Nuestro equipo revisará disponibilidad y cotizará el envío antes de confirmar el valor final del pedido.
        </p>
        <div className="flex items-start gap-2 text-left bg-green-50 border border-green/20 rounded-lg p-3 mb-6">
          <ShieldCheck size={18} className="text-green shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold">Pago en casa / contraentrega</div>
            <div className="text-xs text-muted mt-0.5">No necesitas realizar un pago en línea para registrar esta solicitud. El envío está pendiente de cotización y se confirma contigo antes del despacho.</div>
          </div>
        </div>
        <Link
          href="/"
          className="w-full bg-copper text-white font-semibold py-3 rounded-lg flex items-center justify-center hover:bg-copper-bright transition-colors text-sm"
        >
          Volver a la tienda
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[560px] mx-auto px-5 py-16 text-center text-muted">
          Cargando confirmación...
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}