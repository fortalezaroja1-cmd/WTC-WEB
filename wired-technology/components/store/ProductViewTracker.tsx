"use client";

import { useEffect } from "react";
import { META_CONSENT_ACCEPTED_EVENT, trackMetaEvent } from "@/lib/meta-events";

export function ProductViewTracker({
  sku,
  name,
  value,
}: {
  sku: string;
  name: string;
  value: number;
}) {
  useEffect(() => {
    const send = () => trackMetaEvent("ViewContent", {
      content_ids: [sku],
      content_type: "product",
      content_name: name,
      value,
      currency: "COP",
    });
    if (!send()) {
      window.addEventListener(META_CONSENT_ACCEPTED_EVENT, send, { once: true });
    }
    return () => window.removeEventListener(META_CONSENT_ACCEPTED_EVENT, send);
  }, [sku, name, value]);

  return null;
}
