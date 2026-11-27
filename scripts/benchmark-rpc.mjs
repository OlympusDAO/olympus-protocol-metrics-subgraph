import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { benchmarkPostgresImage } from "./benchmark-images.mjs";

const [mode, sourceInput, credentialsPath, outputInput, revision, ...options] =
  process.argv.slice(2);
const usage =
  "Usage: pnpm run benchmark:rpc <baseline|candidate> <source-dir> <credentials.json> <result.json> <git-commit-or-tree> [baseline-result.json for candidate] [trials]";
if (mode === "--help" && process.argv.length === 3) {
  console.log(usage);
  process.exit(0);
}
const candidate = mode === "candidate";
const [baselinePath, trialsInput = "3"] = candidate ? options : [undefined, options[0]];
const trials = Number(trialsInput);
if (
  !["baseline", "candidate"].includes(mode) ||
  !sourceInput ||
  !credentialsPath ||
  !outputInput ||
  !/^[a-f0-9]{40}$/.test(revision ?? "") ||
  (candidate && !baselinePath) ||
  !Number.isSafeInteger(trials) ||
  trials < 1 ||
  options.length > (candidate ? 2 : 1)
) throw Error(usage);
const sourceRoot = fs.realpathSync(sourceInput);
const requestedOutput = path.resolve(outputInput);
let outputAncestor = path.dirname(requestedOutput);
while (!fs.existsSync(outputAncestor)) outputAncestor = path.dirname(outputAncestor);
const output = path.resolve(
  fs.realpathSync(outputAncestor),
  path.relative(outputAncestor, requestedOutput),
);
const outputLocation = path.relative(sourceRoot, output);
if (!outputLocation.startsWith(`..${path.sep}`) && !path.isAbsolute(outputLocation)) {
  throw Error("Write benchmark evidence outside the source checkout.");
}
const require = createRequire(path.join(sourceRoot, "apps/indexer/package.json"));
const YAML = require("yaml");
const envioBin = path.join(path.dirname(require.resolve("envio/package.json")), "bin.mjs");
let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  if (
    !credentials.ENVIO_API_TOKEN ||
    new URL(credentials.ENVIO_ROBINHOOD_RPC_URL).protocol !== "https:"
  ) {
    throw Error("Benchmark credentials require an Envio token and an HTTPS archive RPC.");
  }
} catch {
  throw Error(
    "Provide a private JSON file with the Envio token and a Robinhood HTTPS archive RPC.",
  );
}
const workload = {
  chain: 4663,
  start: 65044796,
  end: 65664000,
  description: "Robinhood historical fixture with configured start and funded Mellow snapshots",
};
const baseline = candidate ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : undefined;
const baselineDigest = baseline?.trials?.[0]?.phases?.[0]?.entities?.sha256;
if (
  candidate &&
  (baseline.status !== "complete" ||
    baseline.node !== process.version ||
    Object.entries(workload).some(([key, value]) => baseline.workload?.[key] !== value) ||
    baseline.trials.length < 3 ||
    !baselineDigest ||
    !baseline.trials.every(
      (trial) =>
        trial.status === "complete" &&
        trial.phases.length === 2 &&
        trial.phases.every((phase) => phase.entities.sha256 === baselineDigest),
    ))
)
  throw Error(
    "Use the same Node version and a baseline with three matching completed repetitions of this fixture.",
  );

const node = process.execPath;
const campaignRoot = path.dirname(output);
fs.mkdirSync(campaignRoot, { recursive: true, mode: 0o700 });
const result = {
  status: "running",
  mode,
  source: revision,
  node: process.version,
  workload,
  trials: [],
};
const save = () => fs.writeFileSync(output, JSON.stringify(result, null, 2), { mode: 0o600 });
fs.writeFileSync(output, JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
const workRoot = `${output}.trials`;
fs.mkdirSync(workRoot, { mode: 0o700 });
const sourceArchive = path.join(workRoot, "source.tar");
const cacheConfig = path.join(workRoot, "benchmark-erpc.js");
let calls = 0;
const cap = 15000;
let counters = {};
let finalizedHeight = null;
let finalizedGeneration = 0;
let discoveryCalls = 0;
const observer = http.createServer(async (req, res) => {
  const generation = finalizedGeneration;
  try {
    if (candidate && req.url !== "/4663") {
      res.writeHead(503).end("Out of fixture");
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const parsed = JSON.parse(body);
    const requests = Array.isArray(parsed) ? parsed : [parsed];
    calls += requests.length;
    for (const request of requests) {
      counters[request.method] = (counters[request.method] ?? 0) + 1;
      if (
        ["eth_chainId", "eth_syncing", "eth_blockNumber"].includes(request.method) ||
        (request.method === "eth_getBlockByNumber" &&
          ["latest", "finalized", "safe"].includes(request.params?.[0]))
      ) {
        discoveryCalls++;
      }
    }
    if (calls > cap) {
      res.writeHead(429).end("Benchmark RPC cap reached");
      return;
    }
    const upstream = await fetch(credentials.ENVIO_ROBINHOOD_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(35000),
    });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (
      requests.some(
        (request) =>
          request.method === "eth_getBlockByNumber" && request.params?.[0] === "finalized",
      )
    ) {
      const data = JSON.parse(bytes);
      const responses = Array.isArray(data) ? data : [data];
      for (const request of requests.filter((request) => request.params?.[0] === "finalized")) {
        const block = responses.find((response) => response.id === request.id)?.result?.number;
        if (generation === finalizedGeneration && /^0x[0-9a-f]+$/i.test(block ?? ""))
          finalizedHeight = Number(block);
      }
    }
    res.writeHead(upstream.status, { "content-type": "application/json" }).end(bytes);
  } catch {
    res.writeHead(502).end("Benchmark upstream unavailable");
  }
});
await new Promise((resolve) => observer.listen(0, "127.0.0.1", resolve));
const observerPort = observer.address().port;
function command(argv, options = {}) {
  const proc = spawnSync(argv[0], argv.slice(1), { encoding: "utf8", timeout: 120000, ...options });
  if (proc.status !== 0)
    throw Error(`Command failed: ${argv[0]} ${argv[1]}; diagnostic retained privately`);
  return proc.stdout?.trim() ?? "";
}
async function poll(fn, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await sleep(300);
  }
  throw Error("Benchmark condition timed out");
}
async function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise((resolve) => child.once("exit", resolve));
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  await Promise.race([ended, sleep(10000)]);
  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
    await ended;
  }
}
function db(pg, query, database = "metrics") {
  return command([
    "podman",
    "exec",
    pg,
    "psql",
    "-U",
    "postgres",
    "-d",
    database,
    "-At",
    "-c",
    query,
  ]);
}
function entityDigest(pg, database) {
  const names = db(
    pg,
    "SELECT table_schema || '.' || table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema','hdb_catalog','hdb_views') AND table_type='BASE TABLE' ORDER BY 1",
    database,
  )
    .split("\n")
    .filter(Boolean);
  const tables = {};
  const hash = createHash("sha256");
  for (const fullName of names) {
    const [schema, table] = fullName.split(".");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(table))
      throw Error("Unexpected table identifier");
    if (
      /effect|envio|metadata|persisted|event_sync|dynamic_contract|checkpoint|rollback/i.test(
        fullName,
      )
    )
      continue;
    const contents = db(
      pg,
      `SELECT coalesce(jsonb_agg(r ORDER BY r::text), '[]'::jsonb)::text FROM (SELECT to_jsonb(t) r FROM "${schema}"."${table}" t) v`,
      database,
    );
    tables[fullName] = {
      rows: JSON.parse(contents).length,
      sha256: createHash("sha256").update(contents).digest("hex"),
    };
    hash.update(fullName).update(contents);
  }
  return { sha256: hash.digest("hex"), tables };
}

try {
  command(["git", "archive", "--format=tar", `--output=${sourceArchive}`, revision], {
    cwd: sourceRoot,
  });
  const archivedLock = YAML.parse(command(["tar", "-xOf", sourceArchive, "pnpm-lock.yaml"]));
  const installedLock = path.join(sourceRoot, "node_modules/.pnpm/lock.yaml");
  if (
    !fs.existsSync(installedLock) ||
    !isDeepStrictEqual(archivedLock, YAML.parse(fs.readFileSync(installedLock, "utf8")))
  ) {
    throw Error("Use a source checkout with frozen dependencies matching the requested revision.");
  }
  if (candidate) {
    // Host networking is needed to reach the observer and the fixture database.
    // Keep RPC on loopback and disable the separate wildcard metrics listener.
    fs.writeFileSync(
      cacheConfig,
      `import config from "./erpc.js";
export default {
  ...config,
  server: { ...config.server, listenV4: false, listenV6: true, httpHostV6: "[::1]" },
  metrics: { ...config.metrics, enabled: false },
};
`,
    );
    fs.chmodSync(cacheConfig, 0o644); // The container runs as a nonroot user.
  }
  const postgresTag = JSON.parse(
    fs.readFileSync(new URL("../.railway/images.json", import.meta.url), "utf8"),
  ).local["postgres-local"];
  const hasuraTag = "docker.io/hasura/graphql-engine:v2.48.16";
  const inspect = (image) => command(["podman", "image", "inspect", "--format", "{{.Id}}", image]);
  // Historical baselines keep their original immutable image for comparison.
  const { reference: postgresReference, id: postgresImage } = candidate
    ? benchmarkPostgresImage(baseline.images, postgresTag)
    : { reference: postgresTag, id: inspect(postgresTag) };
  const hasuraImage = candidate ? baseline.images[hasuraTag] : inspect(hasuraTag);
  result.images = { [postgresReference]: postgresImage, [hasuraTag]: hasuraImage };
  if (candidate) result.baselineDigest = baselineDigest;
  let cacheImageId;
  let expectedDigest = baselineDigest;
  for (let trial = 0; trial < trials; trial++) {
    const suffix = randomBytes(4).toString("hex");
    const pg = `metrics-bench-pg-${suffix}`;
    const cache = `metrics-bench-cache-${suffix}`;
    const cachePg = `metrics-bench-cache-pg-${suffix}`;
    const hasura = `metrics-bench-hasura-${suffix}`;
    const work = path.join(workRoot, `trial-${trial}`);
    const entry = { trial: trial + 1, status: "running", phases: [] };
    result.trials.push(entry);
    save();
    let child;
    let log;
    try {
      fs.mkdirSync(work, { mode: 0o700 });
      command(["tar", "-xf", sourceArchive, "-C", work]);
      if (candidate && trial === 0) {
        const cacheTag = `localhost/olympus-metrics-rpc-cache:benchmark-${randomBytes(12).toString("hex")}`;
        const imageIdFile = path.join(workRoot, "cache-image.id");
        const buildLog = fs.openSync(path.join(workRoot, "cache-build.log"), "wx", 0o600);
        try {
          command(
            ["podman", "build", "--file", "Dockerfile-rpc-cache", "--tag", cacheTag, "--iidfile", imageIdFile, "."],
            { cwd: work, timeout: 30 * 60_000, stdio: ["ignore", buildLog, buildLog] },
          );
        } finally {
          fs.closeSync(buildLog);
        }
        cacheImageId = fs.readFileSync(imageIdFile, "utf8").trim();
        if (!cacheImageId) throw Error("Candidate cache build did not record an image ID");
        result.images[cacheTag] = cacheImageId;
        save();
      }
      fs.symlinkSync(path.join(sourceRoot, "node_modules"), path.join(work, "node_modules"));
      for (const app of fs.readdirSync(path.join(work, "apps"))) {
        const deps = path.join(sourceRoot, "apps", app, "node_modules");
        if (fs.existsSync(deps)) fs.symlinkSync(deps, path.join(work, "apps", app, "node_modules"));
      }
      const cwd = path.join(work, "apps/indexer");
      const configPath = path.join(cwd, "config.yaml");
      const config = YAML.parse(fs.readFileSync(configPath, "utf8"));
      config.chains = config.chains
        .filter((chain) => chain.id === result.workload.chain)
        .map((chain) => ({ ...chain, end_block: result.workload.end }));
      if (config.chains.length !== 1 || config.chains[0].start_block !== result.workload.start)
        throw Error("Unexpected fixture start");
      fs.writeFileSync(configPath, YAML.stringify(config));
      log = fs.openSync(path.join(work, "indexer.log"), "a", 0o600);
      const inherited = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^(ENVIO_|HASURA_|RAILWAY_|DATABASE_URL$)/.test(key),
        ),
      );
      const baseEnv = {
        ...inherited,
        PATH: `${cwd}/node_modules/.bin:${work}/node_modules/.bin:${path.dirname(node)}:${process.env.PATH}`,
      };
      const password = randomBytes(16).toString("hex");
      command([node, envioBin, "codegen"], {
        cwd,
        env: baseEnv,
        stdio: ["ignore", log, log],
      });
      const startPg = async (name, port) => {
        command([
          "podman",
          "run",
          "--rm",
          "-d",
          "--name",
          name,
          "-p",
          `127.0.0.1:${port}:5432`,
          "-e",
          `POSTGRES_PASSWORD=${password}`,
          "-e",
          "POSTGRES_DB=metrics",
          postgresImage,
        ]);
        await poll(
          () =>
            spawnSync(
              "podman",
              ["exec", name, "pg_isready", "-h", "127.0.0.1", "-p", "5432", "-U", "postgres"],
              { stdio: "ignore" },
            ).status === 0,
        );
      };
      const startHasura = async (database) => {
        command([
          "podman",
          "run",
          "--rm",
          "-d",
          "--name",
          hasura,
          "--network",
          "host",
          "-e",
          `HASURA_GRAPHQL_DATABASE_URL=postgresql://postgres:${password}@127.0.0.1:15432/${database}`,
          "-e",
          `HASURA_GRAPHQL_ADMIN_SECRET=${password}`,
          "-e",
          "HASURA_GRAPHQL_SERVER_PORT=18080",
          "-e",
          "HASURA_GRAPHQL_SERVER_HOST=127.0.0.1",
          hasuraImage,
          "graphql-engine",
          "serve",
        ]);
        await poll(async () => {
          try {
            return (await fetch("http://127.0.0.1:18080/healthz")).ok;
          } catch {
            return false;
          }
        });
      };
      await startPg(pg, 15432);
      await startHasura("metrics");
      if (candidate) {
        await startPg(cachePg, 15433);
        counters = {};
        const beforeCacheStartup = calls;
        finalizedGeneration++;
        finalizedHeight = null;
        const upstreamEnv = [1, 137, 250, 8453, 42161, 80094, 4663].flatMap((id) => [
          "-e",
          `UPSTREAM_RPC_URL_${id}=http://127.0.0.1:${observerPort}/${id}`,
        ]);
        command([
          "podman",
          "run",
          "--rm",
          "-d",
          "--name",
          cache,
          "--network",
          "host",
          "--mount",
          `type=bind,source=${cacheConfig},target=/etc/erpc/benchmark.js,readonly`,
          "-e",
          `RPC_CACHE_DATABASE_URL=postgresql://postgres:${password}@127.0.0.1:15433/metrics?sslmode=disable`,
          ...upstreamEnv,
          cacheImageId,
          "/erpc-server",
          "/etc/erpc/benchmark.js",
        ]);
        await poll(async () => {
          try {
            return (await fetch("http://[::1]:4000/healthcheck")).ok;
          } catch {
            return false;
          }
        });
        await poll(() => finalizedHeight !== null, 45000).catch(() => {});
        entry.cacheStartup = {
          upstreamRequests: calls - beforeCacheStartup,
          methods: counters,
          finalizedHeight,
        };
      }
      const env = {
        ...baseEnv,
        ENVIO_API_TOKEN: credentials.ENVIO_API_TOKEN,
        ENVIO_PG_HOST: "127.0.0.1",
        ENVIO_PG_PORT: "15432",
        ENVIO_PG_USER: "postgres",
        ENVIO_PG_PASSWORD: password,
        ENVIO_PG_DATABASE: "metrics",
        ENVIO_PG_SSL_MODE: "false",
        ENVIO_PG_MAX_CONNECTIONS: "2",
        HASURA_GRAPHQL_ENDPOINT: "http://127.0.0.1:18080/v1/metadata",
        HASURA_GRAPHQL_ADMIN_SECRET: password,
        ENVIO_TUI: "false",
        PORT: "19898",
        RAILWAY_SERVICE_ID: "benchmark",
      };
      delete env.ENVIO_PG_SCHEMA;
      for (const key of Object.keys(credentials))
        if (key.endsWith("_RPC_URL"))
          env[key] = candidate
            ? "http://[::1]:4000/metrics/evm/4663"
            : `http://127.0.0.1:${observerPort}`;
      const phases = ["cold-start", "container-restart"];
      if (candidate) {
        phases.push("warm-cache-rebuild");
        if (trial === 0) phases.push("manual-reset-rebuild");
      }
      const wrapper = path.join(work, "node_modules/.bin/tsx");
      const startIndexer = () =>
        new Promise((resolve, reject) => {
          const started = spawn(wrapper, ["src/start-envio.ts", "start"], {
            cwd,
            env,
            detached: true,
            stdio: ["ignore", log, log],
          });
          started.once("error", reject);
          started.once("spawn", () => resolve(started));
        });
      const cacheRows = () =>
        candidate ? Number(db(cachePg, "SELECT count(*) FROM rpc_cache")) : undefined;
      for (const phase of phases) {
        if (phase === "warm-cache-rebuild") {
          command(["podman", "rm", "-f", hasura]);
          db(pg, "CREATE DATABASE rebuilt");
          await startHasura("rebuilt");
          env.ENVIO_PG_DATABASE = "rebuilt";
        }
        const reset = phase === "manual-reset-rebuild";
        const priorCacheRows = cacheRows();
        if (reset) {
          await stop(child);
          child = undefined;
        }
        counters = {};
        const priorCalls = calls;
        const priorDiscoveryCalls = discoveryCalls;
        const started = performance.now();
        const deadline = Date.now() + 300_000;
        if (reset) {
          await new Promise((resolve, reject) => {
            const resetClient = spawn(node, [envioBin, "local", "db-migrate", "setup"], {
              cwd,
              env,
              stdio: ["ignore", log, log],
              timeout: Math.max(1, deadline - Date.now()),
              killSignal: "SIGKILL",
            });
            let spawnError;
            resetClient.once("error", (error) => {
              spawnError = error;
            });
            resetClient.once("close", (code) =>
              code === 0 && !spawnError
                ? resolve()
                : reject(spawnError ?? Error("Native Envio migration failed")),
            );
          });
        }
        child = await startIndexer();
        await poll(async () => {
          if (child.signalCode || (child.exitCode !== null && child.exitCode !== 0))
            throw Error("Indexer failed before committed completion");
          if (calls > cap) throw Error("Campaign RPC cap exceeded");
          if (child.exitCode !== 0) return false;
          try {
            return (
              Number(
                db(
                  pg,
                  `SELECT progress_block FROM envio_chains WHERE id=${result.workload.chain}`,
                  env.ENVIO_PG_DATABASE,
                ),
              ) >= result.workload.end
            );
          } catch {
            return false;
          }
        }, Math.max(0, deadline - Date.now()));
        const elapsedMs = performance.now() - started;
        const upstreamRequests = calls - priorCalls;
        const discoveryAndFinalityRequests = discoveryCalls - priorDiscoveryCalls;
        const methods = { ...counters };
        const checkpoint = Number(
          db(
            pg,
            `SELECT progress_block FROM envio_chains WHERE id=${result.workload.chain}`,
            env.ENVIO_PG_DATABASE,
          ),
        );
        const digest = entityDigest(pg, env.ENVIO_PG_DATABASE);
        if (
          !(digest.tables["public.TokenRecord"]?.rows > 0) ||
          !(digest.tables["public.ChainMetricValues"]?.rows > 0)
        )
          throw Error("No durable funded snapshot rows; timing is invalid");
        await stop(child);
        child = undefined;
        const measurement = {
          phase,
          elapsedMs: Math.round(elapsedMs),
          upstreamRequests,
          methods,
          discoveryAndFinalityRequests,
          checkpoint,
          persistedCacheRows: cacheRows(),
          priorCacheRows,
          finalizedHeight,
          entities: digest,
        };
        entry.phases.push(measurement);
        save();
        expectedDigest ??= digest.sha256;
        if (digest.sha256 !== expectedDigest)
          throw Error("Entity digest differs from the accepted reference");
        if (reset && measurement.persistedCacheRows < priorCacheRows)
          throw Error("Persistent RPC entries disappeared during indexer reset");
        console.log(
          JSON.stringify({
            trial: trial + 1,
            phase,
            elapsedMs: measurement.elapsedMs,
            upstreamRequests: measurement.upstreamRequests,
            entityTables: Object.keys(digest.tables).length,
          }),
        );
      }
      entry.status = "complete";
    } catch (error) {
      entry.status = "failed";
      entry.error = error.message;
      throw error;
    } finally {
      await stop(child);
      if (log !== undefined) fs.closeSync(log);
      for (const name of [cache, hasura, cachePg, pg])
        spawnSync("podman", ["rm", "-f", name], { stdio: "ignore" });
      save();
    }
  }
  result.status = "complete";
} catch (error) {
  result.status = "failed";
  result.error = error.message;
  process.exitCode = 1;
} finally {
  observer.closeAllConnections();
  observer.close();
  save();
  fs.rmSync(sourceArchive, { force: true });
}
