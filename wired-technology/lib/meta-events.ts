"use client";

// El ID es público; ningún token ni credencial de Meta se almacena aquí.
export const META_PIXEL_ID = "1935627170946474";
export const META_CONSENT_KEY = "wt_meta_pixel_consent_v1";
export const META_CONSENT_ACCEPTED_EVENT = "wt-meta-consent-accepted";

type MetaParams = Record<string, string | number | string[] | undefined>;

type FbqFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  push: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

export function hasMetaConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(META_CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function initializeMetaPixel(): boolean {
  if (typeof window === "undefined" || !hasMetaConsent()) return false;
  if (typeof window.fbq === "function") return true;

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as FbqFunction;

  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", META_PIXEL_ID);
  return true;
}

// Solo transmite eventos después de la aceptación de cookies de publicidad.
export function trackMetaEvent(event: string, params: MetaParams = {}): boolean {
  if (!initializeMetaPixel()) return false;
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  );
  window.fbq?.("track", event, clean);
  return true;
}
