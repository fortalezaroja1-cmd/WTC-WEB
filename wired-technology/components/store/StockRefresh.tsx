"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function StockRefresh() {
  const router = useRouter();
  useEffect(() => {
    let previous: string | undefined;
    let pending = false;
    const abort = new AbortController();
    async function check() {
      if (
        document.visibilityState !== "visible" ||
        pending ||
        abort.signal.aborted
      )
        return;
      pending = true;
      try {
        const result = await fetch("/api/inventario/version", {
          cache: "no-store",
          signal: abort.signal,
        });
        const body = result.ok ? await result.json() : null;
        const version = body?.version ?? "offline";
        if (!abort.signal.aborted && previous !== version) {
          previous = version;
          router.refresh();
        }
      } catch {
        if (!abort.signal.aborted && previous !== "offline") {
          previous = "offline";
          router.refresh();
        }
      } finally {
        pending = false;
      }
    }
    void check();
    const timer = window.setInterval(check, 10000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      abort.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, [router]);
  return null;
}
