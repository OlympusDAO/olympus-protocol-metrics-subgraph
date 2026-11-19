import { verifyIndexerResumeAndReset } from "../../tests/integration/indexer.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const chains = [1, 137, 250, 8453, 42161, 80094, 4663];
const cacheImage = process.env.RPC_CACHE_IMAGE ?? "localhost/olympus-metrics-rpc-cache:local";
const databaseImage = JSON.parse(
  readFileSync(new URL("../../.railway/images.json", import.meta.url), "utf8"),
).local["postgres-local"];
const runtime = process.env.CONTAINER_RUNTIME ?? "docker";
const container = (...args) =>
  execFileSync(runtime, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// eRPC can reserialize object keys; physical request counts must ignore key order.
const requestKey = (chain, method, params) => JSON.stringify([chain, method, params], (_key, value) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
    : value);

async function eventually(check, message) {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      // The container or socket may not be ready yet.
    }
    await delay(200);
  }
  assert.fail(typeof message === "function" ? message() : message);
}

test("eRPC persists finalized calls across process restarts and bypasses volatile responses", {
  timeout: 300_000,
}, async (t) => {
  container("image", "inspect", cacheImage);
  const prefix = `metrics-cache-test-${randomBytes(5).toString("hex")}`;
  const postgres = `${prefix}-postgres`;
  const cache = `${prefix}-erpc`;
  const counts = new Map();
  const upstream = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    const chain = Number(request.url?.split("/")[1]);
    const reply = ({ id, method, params }) => {
      const key = requestKey(chain, method, params);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      switch (method) {
        case "eth_chainId":
          return { jsonrpc: "2.0", id, result: `0x${chain.toString(16)}` };
        case "eth_syncing":
          return { jsonrpc: "2.0", id, result: false };
        case "eth_blockNumber":
          return { jsonrpc: "2.0", id, result: "0x80000" };
        case "eth_getBlockByNumber":
          if (chain === 250 && params[0] === "finalized") {
            return { jsonrpc: "2.0", id, error: { code: -32602, message: "Unsupported tag" } };
          }
          return {
            jsonrpc: "2.0",
            id,
            result: {
              number: ["finalized", "latest"].includes(params[0]) ? "0x80000" : "0x200",
              hash: `0x${"ab".repeat(32)}`,
              parentHash: `0x${"cd".repeat(32)}`,
              receiptsRoot: `0x${"ef".repeat(32)}`,
              timestamp: "0x65000000",
              transactions: [],
              uncles: [],
            },
          };
        case "eth_call":
          if (params[0]?.data === "0xdead") {
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32000, message: "temporary provider failure fixture-provider-secret" },
            };
          }
          return { jsonrpc: "2.0", id, result: "0x1234" };
        default:
          return { jsonrpc: "2.0", id, error: { code: -32601, message: "Unsupported method" } };
      }
    };
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(Array.isArray(body) ? body.map(reply) : reply(body)));
  });

  await new Promise((resolve) => upstream.listen(0, "0.0.0.0", resolve));
  t.after(() => upstream.close());
  container("network", "create", prefix);
  t.after(() => {
    for (const name of [cache, postgres]) {
      try {
        container("rm", "-f", "-v", name);
      } catch {
        // A failed setup may leave a container absent.
      }
    }
    container("network", "rm", prefix);
  });
  container(
    "run", "-d", "--name", postgres, "--network", prefix,
    "-e", "POSTGRES_PASSWORD=cache-fixture",
    databaseImage,
  );
  await eventually(() => {
    container("exec", postgres, "pg_isready", "-h", "127.0.0.1", "-U", "postgres");
    return true;
  }, "Cache Postgres did not become ready");
  assert.equal(container("exec", postgres, "psql", "-U", "postgres", "-Atc", "SHOW server_version"), "18.6");
  assert.equal(container("exec", postgres, "psql", "-U", "postgres", "-Atc", "SHOW data_directory"), "/var/lib/postgresql/18/docker");
  container(
    "run", "-d", "--pull=never", "--name", cache, "--network", prefix,
    ...(runtime === "docker" && process.platform === "linux"
      ? ["--add-host", "host.docker.internal:host-gateway"]
      : []),
    "-p", "127.0.0.1::4000",
    "-p", "127.0.0.1::4001",
    "-e", `RPC_CACHE_DATABASE_URL=postgresql://postgres:cache-fixture@${postgres}:5432/postgres`,
    ...chains.flatMap((chain) => {
      const host = runtime === "podman" ? "host.containers.internal" : "host.docker.internal";
      const endpoint = `http://${host}:${upstream.address().port}/${chain}`;
      return ["-e", `UPSTREAM_RPC_URL_${chain}=${endpoint}/fixture-provider-secret`];
    }),
    cacheImage,
  );
  const base = () => `http://${container("port", cache, "4000/tcp")}`;
  const ready = () => fetch(`${base()}/healthcheck`).then((response) => response.ok);
  await eventually(ready, "eRPC did not become healthy");
  const count = (chain, method, params) => counts.get(requestKey(chain, method, params)) ?? 0;
  await eventually(
    () => [137, 250].every((chain) => count(chain, "eth_getBlockByNumber", ["finalized", false])),
    "eRPC did not check upstream finalized tags",
  );

  // The mock receiving a finalized-tag request is earlier than the poller
  // committing that response. Observe the existing gauge before the first call.
  await eventually(async () => {
    const response = await fetch(`http://${container("port", cache, "4001/tcp")}/metrics`);
    const metrics = await response.text();
    return metrics.split("\n").some((line) => line.startsWith("erpc_upstream_finalized_block_number{") &&
      line.includes('upstream="archive-137"') && Number(line.slice(line.lastIndexOf(" ") + 1)) > 0);
  }, "eRPC did not record the finalized height");

  let id = 0;
  const rpc = async (chain, method, params) => {
    const response = await fetch(`${base()}/metrics/evm/${chain}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    const body = await response.text();
    assert(!body.includes("fixture-provider-secret"));
    return { status: response.headers.get("x-erpc-cache"), body: JSON.parse(body) };
  };

  const call = (chain, params) => rpc(chain, "eth_call", params);
  const target = { to: `0x${"11".repeat(20)}`, data: "0x1234" };
  const historical = [target, "0x100"];
  const first = await call(137, historical);
  assert.equal(first.body.result, "0x1234");
  assert.equal(first.status, "MISS");
  assert.equal(count(137, "eth_call", historical), 1);
  let persistedRows;
  await eventually(() => {
    persistedRows = Number(container("exec", postgres, "psql", "-U", "postgres", "-Atc",
      "SELECT count(*) FROM rpc_cache WHERE partition_key LIKE 'evm:137:%' AND range_key LIKE 'eth_call:%'"));
    return persistedRows >= 1;
  }, () => `Historical call did not persist to Postgres (observed rows: ${persistedRows})`);
  console.log(`Persisted historical-call cache rows: ${persistedRows}`);
  assert.equal((await call(137, historical)).status, "HIT");
  assert.equal(count(137, "eth_call", historical), 1);

  for (const [chain, params, error] of [
    [137, [target, "latest"], false],
    [137, [{ ...target, data: "0xdead" }, "0x100"], true],
    [250, historical, false],
  ]) {
    for (let index = 0; index < 2; index += 1) {
      const response = await call(chain, params);
      assert.notEqual(response.status, "HIT");
      assert.equal(Boolean(response.body.error), error);
      // Separate requests from eRPC in-flight deduplication; this checks persistent cache policy.
      await delay(100);
    }
    assert(count(chain, "eth_call", params) >= 2, `Bypass did not reach upstream twice: chain=${chain}, error=${error}, calls=${count(chain, "eth_call", params)}`);
  }
  for (const tag of ["latest", "safe"]) {
    for (let index = 0; index < 2; index += 1) {
      const response = await rpc(137, "eth_getBlockByNumber", [tag, false]);
      assert.equal(response.body.result?.number, tag === "safe" ? "0x200" : "0x80000");
      assert.notEqual(response.status, "HIT");
    }
  }
  container("restart", cache);
  await eventually(ready, "Restarted eRPC did not become healthy");
  assert.equal((await call(137, historical)).status, "HIT");
  assert.equal(count(137, "eth_call", historical), 1);
  await verifyIndexerResumeAndReset(t, runtime);
  assert.equal((await call(137, historical)).status, "HIT");
  assert.equal(count(137, "eth_call", historical), 1);
  assert(!container("logs", cache).includes("fixture-provider-secret"));
});
