export function rpcUrls(
  prefix: string,
  defaultUrl: string,
  defaultFallbackUrls: string[] = [],
): string[] {
  const envPrefix = `ENVIO_${prefix}`;
  const configuredPrimary = process.env[`${envPrefix}_RPC_URL`]?.trim();
  const primary = configuredPrimary ?? defaultUrl;
  if (!configuredPrimary) {
    console.warn(
      `Using default public archive RPC for ${prefix}. Set ${envPrefix}_RPC_URL for backfills.`,
    );
  }

  const fallbacks = (process.env[`${envPrefix}_FALLBACK_RPC_URLS`] ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  return [primary, ...(fallbacks.length > 0 ? fallbacks : defaultFallbackUrls)];
}
