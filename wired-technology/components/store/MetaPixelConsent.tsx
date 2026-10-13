"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  META_CONSENT_ACCEPTED_EVENT,
  META_CONSENT_KEY,
  initializeMetaPixel,
  trackMetaEvent,
} from "@/lib/meta-events";

type Choice = "accepted" | "rejected" | null;

export function MetaPixelConsent() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<Choice | undefined>(undefined);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(META_CONSENT_KEY);
      setChoice(saved === "accepted" || saved === "rejected" ? saved : null);
    } catch {
      setChoice(null);
    }

    const openPreferences = () => {
      try { localStorage.removeItem(META_CONSENT_KEY); } catch {}
      setChoice(null);
    };
    window.addEventListener("wt-meta-preferences", openPreferences);
    return () => window.removeEventListener("wt-meta-preferences", openPreferences);
  }, []);

  useEffect(() => {
    // Las navegaciones del App Router no recargan el documento: hay que contar cada ruta.
    if (choice === "accepted") trackMetaEvent("PageView");
  }, [pathname, choice]);

  const choose = (value: Exclude<Choice, null>) => {
    try {
      localStorage.setItem(META_CONSENT_KEY, value);
      setChoice(value);
      if (value === "accepted") {
        initializeMetaPixel();
        window.dispatchEvent(new Event(META_CONSENT_ACCEPTED_EVENT));
      }
    } catch {
      // Si el navegador bloquea el almacenamiento, no cargamos el pixel.
      setChoice("rejected");
    }
  };

  if (choice !== null) return null;

  return (
    <section
      role="dialog"
      aria-label="Preferencias de cookies"
      aria-describedby="wt-cookie-description"
      className="fixed bottom-0 inset-x-0 z-[100] bg-white border-t border-hair shadow-2xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-[900px] mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold text-sm text-ink">Cookies de publicidad</p>
          <p id="wt-cookie-description" className="text-sm text-slate-dark mt-1">
            Con tu permiso usamos el píxel de Meta para medir visitas y solicitudes de productos,
            y mejorar nuestros anuncios. Rechazar no afecta tus compras.
            {" "}<a href="/privacidad" className="underline text-copper">Política de privacidad</a>.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <button type="button" onClick={() => choose("rejected")}
            className="min-h-12 rounded-lg border border-hair px-4 text-sm font-semibold text-ink">
            Rechazar
          </button>
          <button type="button" onClick={() => choose("accepted")}
            className="min-h-12 rounded-lg bg-copper px-4 text-sm font-semibold text-white">
            Aceptar
          </button>
        </div>
      </div>
    </section>
  );
}

export function CookiePreferencesButton() {
  return (
    <button
      type="button"
      className="underline underline-offset-2 hover:text-white"
      onClick={() => window.dispatchEvent(new Event("wt-meta-preferences"))}
    >
      Preferencias de cookies
    </button>
  );
}
