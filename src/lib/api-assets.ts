function apiAssetBase() {
  const configured = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_CUSTOMER_API_URL || "";
  return configured.replace(/\/+$/, "").replace(/\/api$/i, "");
}

export function resolveApiAssetUrl(url?: string | null) {
  const value = String(url || "").trim();
  if (!value || /^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/uploads")) return value;

  const base = apiAssetBase();
  return base ? `${base}${value}` : value;
}
