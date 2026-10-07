"use client";

import { useEffect } from "react";
import { trackMetaEvent } from "@/lib/meta-events";

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
    trackMetaEvent("ViewContent", {
      content_ids: [sku],
      content_type: "product",
      content_name: name,
      value,
      currency: "COP",
    });
  }, [sku, name, value]);

  return null;
}
