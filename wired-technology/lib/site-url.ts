/** Public production origin, independent of Vercel deployment addresses. */
export const DEFAULT_SITE_URL = "https://www.wtgy.online";

export function normalizePublicUrl(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return "";
    // Migrate saved links as well as old environment values, preserving their paths.
    if (url.hostname === "wtgy.online" ||
        /^(?:wired-technology(?:-[a-z0-9-]+)?|wtc-web)\.vercel\.app$/i.test(url.hostname)) {
      url.protocol = "https:";
      url.host = "www.wtgy.online";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function siteUrl() {
  return normalizePublicUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL) || DEFAULT_SITE_URL;
}
