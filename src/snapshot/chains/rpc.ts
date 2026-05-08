export function rpcUrls(
  prefix: string,
  defaultUrl: string,
  defaultFallbackUrls: string[] = [],
): string[] {
  const configuredPrimary = process.env[`${prefix}_RPC_URL`]?.trim();
  const primary = configuredPrimary ?? defaultUrl;
  if (!configuredPrimary) {
    console.warn(
      `Using default public archive RPC for ${prefix}. Set ${prefix}_RPC_URL for backfills.`,
    );
  }

  const fallbacks = (process.env[`${prefix}_FALLBACK_RPC_URLS`] ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  return [primary, ...(fallbacks.length > 0 ? fallbacks : defaultFallbackUrls)];
}
