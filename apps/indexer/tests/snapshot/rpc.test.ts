import { afterEach, describe, expect, test, vi } from "vitest";

import { rpcUrls } from "../../src/snapshot/chains/rpc";

describe("rpcUrls", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  test("uses only the configured primary when no explicit fallback is set", () => {
    process.env.ENVIO_ARBITRUM_RPC_URL = "https://alchemy.example.com";
    process.env.ENVIO_ARBITRUM_FALLBACK_RPC_URLS = "";

    expect(
      rpcUrls("ARBITRUM", "https://default.example.com", ["https://public-fallback.example.com"]),
    ).toEqual(["https://alchemy.example.com"]);
  });

  test("keeps explicit fallbacks with a configured primary", () => {
    process.env.ENVIO_ARBITRUM_RPC_URL = "https://alchemy.example.com";
    process.env.ENVIO_ARBITRUM_FALLBACK_RPC_URLS =
      "https://fallback-one.example.com, https://fallback-two.example.com";

    expect(
      rpcUrls("ARBITRUM", "https://default.example.com", ["https://public-fallback.example.com"]),
    ).toEqual([
      "https://alchemy.example.com",
      "https://fallback-one.example.com",
      "https://fallback-two.example.com",
    ]);
  });

  test("uses default fallbacks only when the primary also falls back to default", () => {
    process.env.ENVIO_ARBITRUM_RPC_URL = "";
    process.env.ENVIO_ARBITRUM_FALLBACK_RPC_URLS = "";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(
      rpcUrls("ARBITRUM", "https://default.example.com", ["https://public-fallback.example.com"]),
    ).toEqual(["https://default.example.com", "https://public-fallback.example.com"]);
    expect(warn).toHaveBeenCalledWith(
      "Using default public archive RPC for ARBITRUM. Set ENVIO_ARBITRUM_RPC_URL for backfills.",
    );
  });

  test("treats a whitespace-only primary as unset", () => {
    process.env.ENVIO_ARBITRUM_RPC_URL = "   ";
    process.env.ENVIO_ARBITRUM_FALLBACK_RPC_URLS = "";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(
      rpcUrls("ARBITRUM", "https://default.example.com", ["https://public-fallback.example.com"]),
    ).toEqual(["https://default.example.com", "https://public-fallback.example.com"]);
    expect(warn).toHaveBeenCalledWith(
      "Using default public archive RPC for ARBITRUM. Set ENVIO_ARBITRUM_RPC_URL for backfills.",
    );
  });
});
