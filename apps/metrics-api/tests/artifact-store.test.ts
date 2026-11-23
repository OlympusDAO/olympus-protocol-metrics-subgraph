import { once } from "node:events";
import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { S3ArtifactReader } from "../src/artifact-store";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function reader(handler: (response: ServerResponse) => void, limits = {}) {
  let closed = false;
  const server = createServer((_request, response) => {
    response.on("close", () => {
      closed = true;
    });
    handler(response);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  cleanups.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return {
    store: new S3ArtifactReader({
      endpoint: `http://127.0.0.1:${address.port}`,
      region: "us-east-1",
      bucket: "fixture",
      accessKeyId: "fixture",
      secretAccessKey: "fixture",
      requestTimeoutMs: 500,
      bodyTimeoutMs: 100,
      maxResponseBytes: 64,
      ...limits,
    }),
    closed: () => closed,
  };
}

describe("bounded S3 artifact reads", () => {
  test("keeps a 100ms deadline with auto defaults and an unresponsive loopback IMDS", async () => {
    let metadataRequests = 0;
    const metadata = createServer(() => {
      metadataRequests++;
    });
    metadata.listen(0, "127.0.0.1");
    await once(metadata, "listening");
    cleanups.push(async () => {
      metadata.closeAllConnections();
      await new Promise<void>((resolve) => metadata.close(() => resolve()));
    });
    const address = metadata.address();
    if (!address || typeof address === "string") throw new Error("No metadata test port");
    vi.stubEnv("AWS_DEFAULTS_MODE", "auto");
    vi.stubEnv("AWS_EXECUTION_ENV", undefined);
    vi.stubEnv("AWS_EC2_METADATA_DISABLED", undefined);
    vi.stubEnv("AWS_EC2_METADATA_SERVICE_ENDPOINT", `http://127.0.0.1:${address.port}`);
    try {
      const { store } = await reader(() => {}, { requestTimeoutMs: 100 });
      const started = performance.now();
      await expect(store.getJson("v2/fixture.json", z.unknown())).rejects.toThrow(
        /request timed out/i,
      );
      expect(performance.now() - started).toBeLessThan(500);
      expect(metadataRequests).toBeGreaterThan(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("parses a body through the supplied runtime schema", async () => {
    const { store } = await reader((res) => res.end('{"count":3,"private":"ignored"}'));
    await expect(
      store.getJson("v2/fixture.json", z.object({ count: z.number() })),
    ).resolves.toEqual({ count: 3 });
    await expect(
      store.getJson(
        "v2/fixture.json",
        z.object({
          count: z.number().transform((value) => value + 1),
          label: z.string().default("default"),
        }),
      ),
    ).resolves.toEqual({ count: 4, label: "default" });
  });

  test("stops on the first invalid row without validating the rest of the shard", async () => {
    const visit = vi.fn((row: unknown) => row);
    const schema = z.array(z.preprocess(visit, z.object({ count: z.number() })));
    const body = JSON.stringify(Array.from({ length: 1000 }, () => ({})));
    const { store } = await reader((res) => res.end(body), { maxResponseBytes: 64 * 1024 });
    await expect(store.getJson("v2/fixture.json", schema)).rejects.toThrow(/invalid artifact/i);
    expect(visit).toHaveBeenCalledTimes(1);
  });

  test("rejects a valid JSON body with the wrong shape", async () => {
    const { store } = await reader((res) => res.end('{"count":"wrong"}'));
    await expect(store.getJson("v2/fixture.json", z.object({ count: z.number() }))).rejects.toThrow(
      /invalid artifact/i,
    );
  });

  test("aborts a request that never returns headers", async () => {
    const { store, closed } = await reader(() => {}, { requestTimeoutMs: 80 });
    await expect(store.getJson("v2/fixture.json", z.unknown())).rejects.toThrow(/timed out/i);
    await expect.poll(closed).toBe(true);
  });

  test("destroys a response body that stalls after headers", async () => {
    const { store, closed } = await reader((res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.write('{"count":');
    });
    await expect(store.getJson("v2/fixture.json", z.unknown())).rejects.toThrow(/timed out/i);
    await expect.poll(closed).toBe(true);
  });

  test("bounds chunked bodies without relying on Content-Length", async () => {
    const { store, closed } = await reader((res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.write('"');
      res.write("x".repeat(65));
    });
    await expect(store.getJson("v2/fixture.json", z.unknown())).rejects.toThrow(/size limit/i);
    await expect.poll(closed).toBe(true);
  });

  test("rejects oversized Content-Length before buffering the body", async () => {
    const { store, closed } = await reader((res) => {
      res.writeHead(200, { "content-length": "1000" });
      res.flushHeaders();
    });
    await expect(store.getJson("v2/fixture.json", z.unknown())).rejects.toThrow(/size limit/i);
    await expect.poll(closed).toBe(true);
  });

  test("does not include malformed JSON contents in errors", async () => {
    const { store } = await reader((res) => res.end("fixture-private-content"));
    await expect(store.getJson("v2/fixture.json", z.unknown())).rejects.toThrow(
      /invalid artifact/i,
    );
    await expect(store.getJson("v2/fixture.json", z.unknown())).rejects.not.toThrow(
      "fixture-private-content",
    );
  });
});
