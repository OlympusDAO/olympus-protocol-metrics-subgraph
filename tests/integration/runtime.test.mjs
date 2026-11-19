import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const images = JSON.parse(readFileSync(".railway/images.json", "utf8"));
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  }).trim();
async function eventually(check, message) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      /* bounded startup retry */
    }
    await delay(200);
  }
  assert.fail(message);
}

test("shipped artifact images use compiled production closures", () => {
  const nodeVersion = readFileSync(".node-version", "utf8").trim();
  for (const name of ["metrics-api", "metrics-publisher"]) {
    const result = docker(
      "run",
      "--rm",
      "--pull=never",
      "--network=none",
      images.built[name],
      "node",
      "--input-type=module",
      "-e",
      `
      import assert from 'node:assert/strict';
      import {createRequire} from 'node:module';
      import {existsSync} from 'node:fs';
      const require=createRequire('/app/package.json');
      assert.equal(process.getuid(),1000);
      assert.equal(process.versions.node, ${JSON.stringify(nodeVersion)});
      for(const pkg of ['tsx','envio','typescript','vitest','@biomejs/biome']) {
        assert.throws(()=>require.resolve(pkg));
      }
      assert(!existsSync('/app/apps/indexer'));
      assert(!existsSync('/usr/local/lib/node_modules/npm'));
      await import('/app/dist/apps/${name}/src/${name === "metrics-api" ? "server" : "publisher"}.js');
      console.log('production closure ok');
    `,
    );
    assert.equal(result, "production closure ok");
  }
});

test("patched upstream template preserves an existing PostgreSQL 18 cluster and TLS", {
  timeout: 120_000,
}, async (t) => {
  const prefix = `metrics-pg-compat-${randomBytes(5).toString("hex")}`;
  const previous = `${prefix}-previous`,
    candidate = `${prefix}-candidate`;
  const oldImage = images.comparison["postgres-previous"];
  // Only this test's fresh volume is removed; existing volumes are never selected.
  docker("volume", "create", prefix);
  t.after(() => {
    for (const name of [previous, candidate]) {
      try {
        docker("rm", "-f", name);
      } catch {
        /* setup failed */
      }
    }
    docker("volume", "rm", prefix);
  });
  const start = (name, image) =>
    docker(
      "run",
      "-d",
      "--name",
      name,
      "--network=none",
      "--mount",
      `type=volume,source=${prefix},target=/var/lib/postgresql/data`,
      "-e",
      "POSTGRES_PASSWORD=fixture",
      "-e",
      "POSTGRES_DB=railway",
      "-e",
      "PGDATA=/var/lib/postgresql/data/pgdata",
      image,
    );
  const sql = (name, query) =>
    docker(
      "exec",
      "-e",
      "PGPASSWORD=fixture",
      name,
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
  start(previous, oldImage);
  await eventually(
    () => sql(previous, "SELECT 1") === "1",
    "Previous template did not initialize fixture cluster",
  );
  sql(
    previous,
    "CREATE TABLE compatibility_marker (id int PRIMARY KEY); INSERT INTO compatibility_marker VALUES (42)",
  );
  const systemId = sql(previous, "SELECT system_identifier FROM pg_control_system()");
  const version = sql(previous, "SHOW server_version_num");
  const certificate = docker("exec", previous, "sha256sum", sql(previous, "SHOW ssl_cert_file"));
  docker("stop", previous);
  start(candidate, images.external["postgres-production"]);
  await eventually(
    () => sql(candidate, "SELECT id FROM compatibility_marker") === "42",
    "Candidate did not retain existing data",
  );
  assert.equal(sql(candidate, "SELECT system_identifier FROM pg_control_system()"), systemId);
  assert.equal(sql(candidate, "SHOW ssl"), "on");
  assert.equal(sql(candidate, "SHOW data_directory"), "/var/lib/postgresql/data/pgdata");
  assert.equal(sql(candidate, "SHOW server_version_num"), version);
  assert.equal(
    docker("exec", candidate, "sha256sum", sql(candidate, "SHOW ssl_cert_file")),
    certificate,
  );
  docker("restart", candidate);
  await eventually(
    () => sql(candidate, "SELECT id FROM compatibility_marker") === "42",
    "Candidate restart lost fixture data",
  );
});

test("compiled publisher and API round trip through an HTTP S3 fixture", {
  timeout: 120_000,
}, async (t) => {
  const prefix = `metrics-runtime-${randomBytes(5).toString("hex")}`;
  const date = new Date().toISOString().slice(0, 10);
  const objects = new Map();
  const apiMethods = [];
  const xml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  const s3 = createServer(async (req, res) => {
    const url = new URL(req.url, "http://fixture");
    if (url.pathname === "/graphql") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const { query } = JSON.parse(Buffer.concat(chunks).toString());
      let data;
      if (query.includes("query Bounds")) data = { earliest: [{ date }], latest: [{ date }] };
      else if (query.includes("LatestIndexingProgress")) data = {};
      else if (query.includes("GlobalMetricSnapshot"))
        data = {
          GlobalMetricSnapshot: [
            {
              date,
              crossChainComplete: true,
              chainsIndexed: [1, 137, 250, 4663, 8453, 42161, 80094],
              chainsMissing: [],
              chainValues: [],
              supplyCategories: [],
              ohmPrice: 12,
            },
          ],
        };
      else if (query.includes("TokenRecord")) data = { TokenRecord: [] };
      else if (query.includes("TokenSupply")) data = { TokenSupply: [] };
      else {
        res.writeHead(400).end();
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ data }));
      return;
    }

    const key = decodeURIComponent(url.pathname.replace(/^\/metrics\/?/, ""));
    const reader = req.headers.authorization?.includes("Credential=fixture-reader/");
    if (reader) apiMethods.push(req.method);
    if (reader && req.method !== "GET") {
      res.writeHead(403).end();
      return;
    }
    if (url.searchParams.has("list-type")) {
      const rows = [...objects.keys()].filter((key) =>
        key.startsWith(url.searchParams.get("prefix") ?? ""),
      );
      res.setHeader("content-type", "application/xml");
      res.end(
        `<ListBucketResult><IsTruncated>false</IsTruncated>${rows.map((key) => `<Contents><Key>${xml(key)}</Key></Contents>`).join("")}</ListBucketResult>`,
      );
      return;
    }
    const existing = objects.get(key);
    if (
      (req.headers["if-none-match"] === "*" && existing) ||
      (req.headers["if-match"] && req.headers["if-match"] !== existing?.etag)
    ) {
      res
        .writeHead(412, { "content-type": "application/xml" })
        .end("<Error><Code>PreconditionFailed</Code></Error>");
      return;
    }
    if (req.method === "PUT") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
      objects.set(key, { body, etag });
      res.setHeader("etag", etag);
      res.end();
      return;
    }
    if (req.method === "DELETE") {
      objects.delete(key);
      res.writeHead(204).end();
      return;
    }
    if (!existing) {
      res
        .writeHead(404, { "content-type": "application/xml" })
        .end("<Error><Code>NoSuchKey</Code></Error>");
      return;
    }
    res.setHeader("etag", existing.etag);
    res.end(existing.body);
  });
  await new Promise((done) => s3.listen(0, "0.0.0.0", done));
  t.after(() => {
    s3.closeAllConnections();
    s3.close();
  });
  const host = "host.docker.internal";
  const hostArgs = process.platform === "linux" ? ["--add-host", `${host}:host-gateway`] : [];
  const endpoint = `http://${host}:${s3.address().port}`;
  const published = await promisify(execFile)(
    "docker",
    [
      "run",
      "--rm",
      "--pull=never",
      ...hostArgs,
      ...Object.entries({
        ARTIFACT_ENDPOINT: endpoint,
        ARTIFACT_REGION: "us-east-1",
        ARTIFACT_BUCKET: "metrics",
        ARTIFACT_ACCESS_KEY_ID: "fixture-publisher",
        ARTIFACT_SECRET_ACCESS_KEY: "fixture-publisher-password",
        HASURA_GRAPHQL_ENDPOINT: `${endpoint}/graphql`,
        HASURA_GRAPHQL_ADMIN_SECRET: "fixture",
        INDEXER_DEPLOYMENT_ID: "integration",
        PUBLISHER_PUBLIC_START_DATE: date,
        PUBLISHER_START_DATE: date,
        PUBLISHER_END_DATE: date,
      }).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
      images.built["metrics-publisher"],
    ],
    { timeout: 60_000 },
  );
  const publication = JSON.parse(published.stdout);
  assert.equal(publication.skipped, false);
  assert.equal(publication.manifestPublishedLast, true);
  assert.equal(
    JSON.parse(
      objects.get(`v2/deployments/integration/metrics/daily/${date.slice(0, 7)}.json`).body,
    )[0].ohmPrice,
    12,
  );
  const api = `${prefix}-api`;
  t.after(() => {
    try {
      docker("rm", "-f", api);
    } catch {
      /* failed setup */
    }
  });
  docker(
    "run",
    "-d",
    "--pull=never",
    "--name",
    api,
    ...hostArgs,
    "-p",
    "127.0.0.1::3000",
    "-e",
    "PORT=3000",
    "-e",
    "ARTIFACT_BUCKET=metrics",
    "-e",
    "ARTIFACT_REGION=us-east-1",
    "-e",
    `ARTIFACT_ENDPOINT=${endpoint}`,
    "-e",
    "ARTIFACT_ACCESS_KEY_ID=fixture-reader",
    "-e",
    "ARTIFACT_SECRET_ACCESS_KEY=fixture-reader-password",
    images.built["metrics-api"],
  );
  let base = `http://${docker("port", api, "3000/tcp")}`;
  await eventually(
    async () => (await fetch(`${base}/ready`)).status === 200,
    "Compiled API did not become ready",
  );
  const response = await fetch(`${base}/v2/metrics/daily?start=${date}&end=${date}`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].date, date);
  assert.equal(result.data[0].ohmPrice, 12);
  objects.get(`v2/deployments/integration/metrics/daily/${date.slice(0, 7)}.json`).body =
    Buffer.from('{"date":"invalid"}');
  const bad = await fetch(`${base}/v2/metrics/daily?start=${date}&end=${date}`);
  assert.equal(bad.status, 503);
  assert(!(await bad.text()).includes("fixture-reader-password"));
  docker("restart", api);
  base = `http://${docker("port", api, "3000/tcp")}`;
  await eventually(
    async () => (await fetch(`${base}/ready`)).status === 200,
    "Restarted API did not become ready",
  );
  assert.equal((await fetch(`${base}/v2/bounds`)).status, 200);
  assert(apiMethods.length > 0);
  assert(apiMethods.every((method) => method === "GET"));
});

test("real Hasura image starts privately against PostgreSQL", { timeout: 120_000 }, async (t) => {
  const prefix = `metrics-hasura-${randomBytes(5).toString("hex")}`;
  const pg = `${prefix}-pg`,
    hasura = `${prefix}-hasura`;
  docker("network", "create", prefix);
  t.after(() => {
    for (const name of [hasura, pg]) {
      try {
        docker("rm", "-f", name);
      } catch {
        /* setup failed */
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
    images.external["postgres-local"],
  );
  await eventually(() => {
    docker("exec", pg, "pg_isready", "-U", "postgres");
    return true;
  }, "Postgres did not become ready");
  docker(
    "run",
    "-d",
    "--pull=never",
    "--name",
    hasura,
    "--network",
    prefix,
    "-e",
    `HASURA_GRAPHQL_DATABASE_URL=postgresql://postgres:fixture@${pg}:5432/postgres`,
    "-e",
    "HASURA_GRAPHQL_ADMIN_SECRET=fixture",
    "-e",
    "PORT=8080",
    "-p",
    "127.0.0.1::8080",
    images.built.hasura,
  );
  const base = `http://${docker("port", hasura, "8080/tcp")}`;
  await eventually(
    async () => (await fetch(`${base}/healthz`)).ok,
    "Real Hasura image failed health check",
  );
  assert.equal(
    (
      await fetch(`${base}/v1/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hasura-admin-secret": "fixture" },
        body: JSON.stringify({ query: "{__typename}" }),
      })
    ).status,
    200,
  );
});
