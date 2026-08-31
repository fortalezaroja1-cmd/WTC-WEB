"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, MessageCircle } from "lucide-react";

function ConfirmationContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order") || "—";
  const waMsg = `Hola Wired Technology, confirmo mi pedido ${orderNumber}. ¿Cómo hago el pago?`;
  const waUrl = `https://wa.me/573000000000?text=${encodeURIComponent(waMsg)}`;

  return (
    <div className="max-w-[560px] mx-auto px-5 py-16">
      <div className="bg-card border border-hair rounded-xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-green" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-1">¡Pedido recibido!</h1>
        <p className="font-mono text-sm text-muted mb-6">{orderNumber}</p>
        <p className="text-sm text-slate-dark mb-6">
          Para confirmar el pago y coordinar el envío, escríbenos por WhatsApp.
        </p>
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full bg-green text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity mb-3"
        >
          <MessageCircle size={17} /> Confirmar por WhatsApp
        </a>
        <Link
          href="/"
          className="w-full border border-hair font-semibold py-3 rounded-lg flex items-center justify-center hover:border-copper transition-colors text-sm"
        >
          Seguir comprando
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
