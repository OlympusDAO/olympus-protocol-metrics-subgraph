import { afterEach, describe, expect, test, vi } from "vitest";

import { rpcUrls } from "../../src/snapshot/chains/rpc";
import { retryRpc } from "../../src/snapshot/rpc-client";

describe("rpcUrls", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
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

describe("retryRpc", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("retries viem block-not-found errors from lagging providers", async () => {
    vi.useFakeTimers();
    const blockNotFound = Object.assign(
      new Error('Block at number "25435200" could not be found.'),
      {
        name: "BlockNotFoundError",
        shortMessage: 'Block at number "25435200" could not be found.',
        version: "2.52.2",
      },
    );
    const operation = vi.fn().mockRejectedValueOnce(blockNotFound).mockResolvedValueOnce("ok");

    const result = retryRpc(operation);

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test("retries provider internal errors wrapped as invalid input", async () => {
    vi.useFakeTimers();
    const rpcRequest = Object.assign(new Error("RPC Request failed."), {
      name: "RpcRequestError",
      details: "Internal error",
    });
    const invalidInput = Object.assign(new Error("Missing or invalid parameters."), {
      name: "InvalidInputRpcError",
      cause: rpcRequest,
    });
    const callExecution = Object.assign(new Error("Contract call failed."), {
      name: "CallExecutionError",
      cause: invalidInput,
    });
    const operation = vi.fn().mockRejectedValueOnce(callExecution).mockResolvedValueOnce("ok");

    const result = retryRpc(operation);

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test.each([
    Object.assign(new Error("An internal error was received."), {
      name: "InternalRpcError",
    }),
    Object.assign(new Error("RPC Request failed."), {
      code: -32603,
    }),
  ])("retries canonical JSON-RPC internal errors", async (internalError) => {
    vi.useFakeTimers();
    const operation = vi.fn().mockRejectedValueOnce(internalError).mockResolvedValueOnce("ok");

    const result = retryRpc(operation);

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test("does not retry genuine invalid-input errors", async () => {
    const invalidInput = Object.assign(new Error("Missing or invalid parameters."), {
      name: "InvalidInputRpcError",
      details: "Invalid params",
    });
    const operation = vi.fn().mockRejectedValue(invalidInput);

    await expect(retryRpc(operation)).rejects.toBe(invalidInput);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
