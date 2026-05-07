export function rpcUrls(prefix: string, defaultUrl: string): string[] {
  const primary = process.env[`${prefix}_RPC_URL`] ?? defaultUrl;
  const fallbacks = (process.env[`${prefix}_FALLBACK_RPC_URLS`] ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  return [primary, ...fallbacks];
}
