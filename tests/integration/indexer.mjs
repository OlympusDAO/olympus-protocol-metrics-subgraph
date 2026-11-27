import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Called while the eRPC test has a known nonempty persisted cache entry.
// Uses only fresh fixture databases, never a developer's database or volume.
export async function verifyIndexerResumeAndReset(t, runtime = "docker") {
  const images = JSON.parse(readFileSync(".railway/images.json", "utf8"));
  const docker = (...args) =>
    execFileSync(runtime, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    }).trim();
  const logs = () => {
    const { stdout, stderr } = spawnSync(runtime, ["logs", indexer], {
      encoding: "utf8",
      timeout: 5_000,
      killSignal: "SIGKILL",
    });
    return `${stdout ?? ""}${stderr ?? ""}`;
  };
  const prefix = `metrics-indexer-${randomBytes(5).toString("hex")}`;
  const pg = `${prefix}-pg`,
    hasura = `${prefix}-hasura`,
    indexer = `${prefix}-indexer`;
  const directory = mkdtempSync(join(tmpdir(), "metrics-indexer-fixture-"));
  // Retain this tiny credential-free fixture for failed-test diagnosis.
  const configFile = join(directory, "config.yaml");
  writeFileSync(
    configFile,
    readFileSync("apps/indexer/config.yaml", "utf8").replace(
      /^( {2}- id: \d+[^\n]*)$/gm,
      "$1\n    hypersync_config:\n      url: http://127.0.0.1:1",
    ),
  );
  const psql = [
    "-e",
    "PGPASSWORD=fixture",
    pg,
    "psql",
    "-X",
    "-w",
    "-h",
    "127.0.0.1",
    "-U",
    "postgres",
    "-d",
    "railway",
    "-v",
    "ON_ERROR_STOP=1",
  ];
  const sql = (query) => docker("exec", ...psql, "-Atc", query);
  const resetScript = readFileSync(
    new URL("../../scripts/reset-indexer-schema.sql", import.meta.url),
  );
  const resetSchema = () =>
    execFileSync(runtime, ["exec", "-i", ...psql, "--file=-"], {
      input: resetScript,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60_000,
    });
  async function eventually(check, message) {
    for (let i = 0; i < 200; i++) {
      try {
        if (await check()) return;
      } catch {
        /* bounded startup retry */
      }
      await delay(200);
    }
    try {
      console.error(logs());
    } catch {
      // A failed diagnostic must preserve the fixture assertion.
    }
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
  const indexerOptions = [
    "--network",
    prefix,
    "--mount",
    `type=bind,source=${configFile},target=/app/apps/indexer/config.yaml,readonly`,
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
  ];
  docker("run", "-d", "--pull=never", "--name", indexer, ...indexerOptions, images.built.indexer);
  await eventually(
    () => sql(`SELECT count(*) FROM envio_info`) === "1",
    "Real indexer did not initialize storage",
  );
  sql(
    `INSERT INTO "BackfillSentinel" (id,"chainId","seededAtBlock","firedAtBlock",seeded,skipped) VALUES ('resume-fixture',1,1,0,1,0)`,
  );
  const sentinel = () => sql(`SELECT count(*) FROM "BackfillSentinel" WHERE id='resume-fixture'`);
  docker("restart", indexer);
  await eventually(() => {
    const output = logs();
    return output.includes("Resuming") || output.includes("resum");
  }, "Real indexer did not report resume");
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
  const storedConfig = () => sql("SELECT config::text FROM envio_info WHERE id = 1");
  const originalConfig = JSON.parse(storedConfig());
  assert.equal(Object.hasOwn(originalConfig, "chainIdMode"), false);
  docker("stop", indexer);
  sql(`UPDATE envio_info
    SET config = jsonb_set(config::jsonb, '{chainIdMode}', '"int64"'::jsonb)
    WHERE id = 1`);
  const incompatibleConfig = storedConfig();
  assert.deepEqual(JSON.parse(incompatibleConfig), { ...originalConfig, chainIdMode: "int64" });
  docker("start", indexer);
  await eventually(
    () => docker("inspect", "--format", "{{.State.Status}}", indexer) === "exited",
    "Native Envio did not exit on an incompatible chainIdMode",
  );
  assert.match(docker("inspect", "--format", "{{.State.ExitCode}}", indexer), /^[1-9]\d*$/);
  const failure = logs();
  assert.match(failure, /config changes are incompatible with the existing indexer data/);
  assert.match(failure, /- chainIdMode\b/);
  assert.equal(storedConfig(), incompatibleConfig);
  assert.equal(sentinel(), "1");

  docker("stop", hasura);
  assert.equal(sql("SELECT current_database()"), "railway");
  const publicAcl = () =>
    sql(`SELECT ARRAY(
      SELECT entry::text FROM unnest(nspacl) AS entry ORDER BY entry::text COLLATE "C"
    )::text FROM pg_namespace WHERE nspname = 'public'`);
  const originalAcl = publicAcl();
  sql("REVOKE USAGE ON SCHEMA public FROM PUBLIC");
  const alteredAcl = publicAcl();
  assert.notEqual(alteredAcl, originalAcl);
  assert.throws(resetSchema, {
    status: 3,
    stderr: /Unsupported owner or ACL on existing public schema/,
  });
  assert.equal(publicAcl(), alteredAcl);
  assert.equal(storedConfig(), incompatibleConfig);
  assert.equal(sentinel(), "1");
  sql("GRANT USAGE ON SCHEMA public TO PUBLIC");
  assert.equal(publicAcl(), originalAcl);
  resetSchema();
  assert.equal(sql("SELECT to_regclass('public.envio_info') IS NULL"), "t");
  assert.equal(publicAcl(), originalAcl);
  docker("start", hasura);
  docker("start", indexer);
  await eventually(
    () =>
      docker(
        "exec",
        indexer,
        "node",
        "--input-type=module",
        "-e",
        "console.log((await fetch('http://127.0.0.1:9898/healthz', {signal: AbortSignal.timeout(2000)})).status);",
      ) === "200",
    "Native indexer did not return HTTP 200 from /healthz after the database-host reset",
  );
  assert.deepEqual(JSON.parse(storedConfig()), originalConfig);
  assert.equal(sentinel(), "0");
  console.log(
    "Native Envio resumed, exited on incompatible storage with data intact, and restarted after the PostgreSQL-host schema reset. Template TLS/PGDATA verified.",
  );
}
