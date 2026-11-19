import assert from "node:assert/strict";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

// Called while the eRPC test has a known nonempty persisted cache entry.
// Uses only fresh fixture databases, never a developer's database or volume.
export async function verifyIndexerResumeAndReset(t, runtime = "docker") {
  const images = JSON.parse(readFileSync(".railway/images.json", "utf8"));
  if (process.env.METRICS_INTEGRATION_IMAGES)
    images.built = JSON.parse(process.env.METRICS_INTEGRATION_IMAGES);
  const docker = (...args) =>
    execFileSync(runtime, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    }).trim();
  const logs = () =>
    spawnSync(runtime, ["logs", indexer], { encoding: "utf8" }).output.slice(1).join("");
  const prefix = `metrics-indexer-${randomBytes(5).toString("hex")}`;
  const pg = `${prefix}-pg`,
    hasura = `${prefix}-hasura`,
    indexer = `${prefix}-indexer`;
  const directory = mkdtempSync(join(tmpdir(), "metrics-indexer-fixture-"));
  // Retain this tiny credential-free fixture for failed-test diagnosis.
  writeFileSync(
    join(directory, "config.yaml"),
    readFileSync("apps/indexer/config.yaml", "utf8").replace(
      /^( {2}- id: \d+[^\n]*)$/gm,
      "$1\n    hypersync_config:\n      url: http://127.0.0.1:1",
    ),
  );
  const sql = (query) =>
    docker(
      "exec",
      "-e",
      "PGPASSWORD=fixture",
      pg,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      "railway",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atc",
      query,
    );
  async function eventually(check, message) {
    for (let i = 0; i < 200; i++) {
      try {
        if (await check()) return;
      } catch {
        /* bounded startup retry */
      }
      await delay(200);
    }
    console.error(logs());
    assert.fail(message);
  }
  docker("network", "create", "--internal", prefix);
  t.after(() => {
    for (const name of [indexer, hasura, pg]) {
      try {
        docker("rm", "-f", "-v", name);
      } catch {
        /* failed setup */
      }
    }
    docker("network", "rm", prefix);
  });
  docker(
    "run",
    "-d",
    "--pull=never",
    "--name",
    pg,
    "--network",
    prefix,
    "-e",
    "POSTGRES_PASSWORD=fixture",
    "-e",
    "POSTGRES_DB=railway",
    "-e",
    "PGDATA=/var/lib/postgresql/data/pgdata",
    images.provider["postgres-production"],
  );
  await eventually(() => sql("SELECT 1") === "1", "Template PostgreSQL did not become ready");
  assert.equal(sql("SHOW ssl"), "on");
  assert.equal(sql("SHOW data_directory"), "/var/lib/postgresql/data/pgdata");
  assert.equal(sql("SHOW server_version_num").slice(0, 2), "18");
  docker(
    "run",
    "-d",
    "--pull=never",
    "--name",
    hasura,
    "--network",
    prefix,
    "-e",
    `HASURA_GRAPHQL_DATABASE_URL=postgresql://postgres:fixture@${pg}:5432/railway`,
    "-e",
    "HASURA_GRAPHQL_ADMIN_SECRET=fixture",
    images.built.hasura,
  );
  docker(
    "run",
    "-d",
    "--pull=never",
    "--name",
    indexer,
    "--network",
    prefix,
    "--mount",
    `type=bind,source=${join(directory, "config.yaml")},target=/app/apps/indexer/config.yaml,readonly`,
    ...Object.entries({
      ENVIO_API_TOKEN: "fixture",
      ENVIO_PG_HOST: pg,
      ENVIO_PG_PORT: "5432",
      ENVIO_PG_USER: "postgres",
      ENVIO_PG_PASSWORD: "fixture",
      ENVIO_PG_DATABASE: "railway",
      ENVIO_PG_SSL_MODE: "false",
      ENVIO_TUI: "false",
      HASURA_GRAPHQL_ENDPOINT: `http://${hasura}:8080/v1/graphql`,
      HASURA_GRAPHQL_ADMIN_SECRET: "fixture",
      ...Object.fromEntries(
        ["ETHEREUM", "ARBITRUM", "BERACHAIN", "ROBINHOOD", "BASE", "POLYGON", "FANTOM"].map(
          (chain) => [`ENVIO_${chain}_RPC_URL`, "http://127.0.0.1:1"],
        ),
      ),
    }).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
    images.built.indexer,
  );
  await eventually(
    () => sql(`SELECT count(*) FROM envio_info`) === "1",
    "Real indexer did not initialize storage",
  );
  sql(
    `INSERT INTO "BackfillSentinel" (id,"chainId","seededAtBlock","firedAtBlock",seeded,skipped) VALUES ('resume-fixture',1,1,0,1,0)`,
  );
  const sentinel = () => sql(`SELECT count(*) FROM "BackfillSentinel" WHERE id='resume-fixture'`);
  docker("restart", indexer);
  await eventually(
    () => logs().includes("Resuming") || logs().includes("resum"),
    "Real indexer did not report resume",
  );
  assert.equal(sentinel(), "1");
  await eventually(() => {
    docker(
      "exec",
      indexer,
      "node",
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';
    assert.equal(process.versions.node, ${JSON.stringify(readFileSync(".node-version", "utf8").trim())});
    assert.equal((await fetch('http://127.0.0.1:9898/healthz', {signal: AbortSignal.timeout(2000)})).status, 200);
    for (const path of ['/docs', '/openapi.json', '/llms.txt']) {
      const response = await fetch('http://127.0.0.1:9898' + path, {signal: AbortSignal.timeout(2000)});
      assert.equal(response.status, 404);
    }
  `,
    );
    return true;
  }, "Private ingestion server did not reject documentation/spec routes");
  // Force the supported incompatible-config pause before an explicit reset.
  docker("stop", indexer);
  sql(`UPDATE envio_info SET config='{}' WHERE id=1`);
  docker("start", indexer);
  await eventually(
    () => logs().includes("Ingestion is paused"),
    "Incompatible storage did not pause ingestion",
  );
  assert.equal(sentinel(), "1");
  const result = await promisify(execFile)(
    runtime,
    ["exec", indexer, "tsx", "src/start-envio.ts", "reset"],
    { timeout: 60_000 },
  );
  assert(result.stdout.includes("Envio migration completed"));
  assert.equal(sentinel(), "0");
  assert.equal(sql("SELECT count(*) FROM envio_info"), "1");
  console.log(
    "Real indexer preserved a managed entity on restart, paused incompatible storage, and reset only its application database; template TLS/PGDATA verified.",
  );
}
