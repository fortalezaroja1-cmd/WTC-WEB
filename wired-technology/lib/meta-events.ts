"use client";

type MetaParams = Record<string, string | number | string[] | undefined>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackMetaEvent(event: string, params: MetaParams = {}) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  );
  window.fbq("track", event, clean);
}
