import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const entrypoint = fileURLToPath(new URL("../dist/monitor-indexer.js", import.meta.url));
const statePath = "/fixture-state/indexer-monitor/state.json";
const minute = 60_000;
const reachable = "Indexer monitor metrics reachable.\n";
const unreachable = "Indexer monitor metrics unreachable.\n";
const suppressed =
  "Indexer monitor metrics unreachable. Error notification suppressed by cooldown.\n";
const outageAck = `${unreachable}Indexer monitor outage notification acknowledged.\n`;
const recoveryAck = `${reachable}Indexer monitor recovery notification acknowledged.\n`;

async function fixture(t) {
  const remote = { state: null, metricsStatus: 503, webhookStatus: 204, calls: [], posts: [] };
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, "http://fixture").pathname;
    const key = `${request.method} ${path}`;
    remote.calls.push(key);
    let body = "";
    for await (const chunk of request) body += chunk;
    switch (key) {
      case `GET ${statePath}`:
        if (remote.drip) {
          response.writeHead(200, { "content-type": "application/json" });
          response.write("{");
          const interval = setInterval(() => response.write(" "), 100);
          response.once("close", () => clearInterval(interval));
          return;
        }
        if (remote.readError || remote.state === null) {
          const error = remote.readError ?? [404, "NoSuchKey"];
          response.writeHead(error[0], { "content-type": "application/xml" });
          response.end(`<Error><Code>${error[1]}</Code><Message>fixture-secret</Message></Error>`);
          return;
        }
        response
          .writeHead(200, { "content-type": "application/json" })
          .end(typeof remote.state === "string" ? remote.state : JSON.stringify(remote.state));
        return;
      case `PUT ${statePath}`:
        if (remote.denyWrite) {
          response
            .writeHead(403, { "content-type": "application/xml" })
            .end("<Error><Code>AccessDenied</Code><Message>fixture-secret</Message></Error>");
          return;
        }
        remote.state = JSON.parse(body);
        response.writeHead(200).end();
        return;
      case "GET /metrics":
        if (!remote.hangMetrics) {
          response.writeHead(remote.metricsStatus, { location: "/ready" }).end();
        }
        return;
      case "POST /preview-webhook":
      case "POST /webhook":
        remote.posts.push(JSON.parse(body));
        if (!remote.hangWebhook) response.writeHead(remote.webhookStatus).end("fixture-secret");
        return;
      default:
        response.writeHead(404).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  remote.env = {
    INDEXER_METRICS_URL: `${origin}/metrics`,
    DISCORD_WEBHOOK_URL: `${origin}/webhook?token=fixture-secret`,
    MONITOR_NAME: "Protocol Indexer / preview",
    BUCKET: "fixture-state",
    ENDPOINT: origin,
    REGION: "auto",
    ACCESS_KEY_ID: "fixture-key",
    SECRET_ACCESS_KEY: "fixture-secret",
  };
  return remote;
}

function start(t, env) {
  const started = performance.now();
  const child = spawn(process.execPath, [entrypoint], { env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr += chunk;
  });
  const closed = once(child, "close").then(([code, signal]) => ({
    code,
    signal,
    stdout,
    stderr,
    elapsed: performance.now() - started,
  }));
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await closed;
  });
  async function result() {
    const timeout = new AbortController();
    try {
      return await Promise.race([
        closed,
        setTimeout(8_000, null, { signal: timeout.signal }).then(() => {
          assert.fail("monitor did not exit");
        }),
      ]);
    } finally {
      timeout.abort();
    }
  }
  return { child, result };
}

async function run(t, remote, diagnostic = "", env = remote.env) {
  const { elapsed, stdout, ...exit } = await start(t, env).result();
  assert.deepEqual(exit, {
    code: diagnostic ? 1 : 0,
    signal: null,
    stderr: diagnostic ? `${diagnostic}\n` : "",
  });
  return { elapsed, stdout };
}

function assertEmbed(payload, expected, earliest) {
  assert(Array.isArray(payload.embeds), "Discord POST must include embeds");
  assert.equal(payload.embeds.length, 1);
  const [{ timestamp, ...embed }] = payload.embeds;
  assert.deepEqual(embed, expected);
  const sentAt = Date.parse(timestamp);
  assert(sentAt >= earliest && sentAt <= Date.now());
  assert.equal(timestamp, new Date(sentAt).toISOString());
}

test("copied production settings use the runtime environment for webhook and label", async (t) => {
  const remote = await fixture(t);
  const configured = {
    ...remote.env,
    MONITOR_NAME: "Protocol Indexer",
    DISCORD_PRODUCTION_ENVIRONMENT_ID: "fixture-production",
    DISCORD_WEBHOOK_URL_PREVIEW: remote.env.DISCORD_WEBHOOK_URL.replace(
      "/webhook",
      "/preview-webhook",
    ),
  };
  for (const [environment, route, label, runtimeId] of [
    ["production", "POST /webhook", "Protocol Indexer", "fixture-production"],
    ["renamed-production", "POST /webhook", "Protocol Indexer", "fixture-production"],
    [
      "protocol-indexer-pr-42",
      "POST /preview-webhook",
      "Protocol Indexer / protocol-indexer-pr-42",
      "fixture-preview",
    ],
  ]) {
    remote.state = null;
    remote.calls = [];
    remote.posts = [];
    await run(t, remote, "", {
      ...configured,
      RAILWAY_ENVIRONMENT_NAME: environment,
      RAILWAY_ENVIRONMENT_ID: runtimeId,
    });
    assert.deepEqual(
      remote.calls.filter((call) => call.startsWith("POST ")),
      [route],
    );
    assert.equal(remote.posts[0].content, `${label}: metrics are unreachable.`);
  }
  remote.state = null;
  remote.calls = [];
  await run(t, remote, "", {
    ...configured,
    DISCORD_WEBHOOK_URL: undefined,
    RAILWAY_ENVIRONMENT_NAME: "protocol-indexer-pr-42",
  });
  assert.deepEqual(
    remote.calls.filter((call) => call.startsWith("POST ")),
    ["POST /preview-webhook"],
  );
  remote.calls = [];
  await run(t, remote, "Invalid indexer monitor configuration.", {
    ...configured,
    RAILWAY_ENVIRONMENT_ID: "fixture-preview",
    RAILWAY_ENVIRONMENT_NAME: undefined,
  });
  assert.deepEqual(remote.calls, []);
  const { DISCORD_WEBHOOK_URL_PREVIEW: _, ...withoutPreview } = configured;
  for (const value of [
    undefined,
    "",
    "file:///fixture-secret",
    "http://user:fixture-secret@127.0.0.1/",
  ]) {
    await run(t, remote, "Invalid indexer monitor configuration.", {
      ...withoutPreview,
      DISCORD_WEBHOOK_URL_PREVIEW: value,
      RAILWAY_ENVIRONMENT_NAME: "protocol-indexer-pr-42",
    });
    assert.deepEqual(remote.calls, []);
  }
});

test("missing and invalid configuration exit before any requests", async (t) => {
  const remote = await fixture(t);
  for (const name of Object.keys(remote.env).filter((name) => name !== "MONITOR_NAME")) {
    const { [name]: _, ...incomplete } = remote.env;
    const { stdout } = await run(t, remote, "Invalid indexer monitor configuration.", incomplete);
    assert.equal(stdout, "");
  }
  for (const [name, value] of [
    ["INDEXER_METRICS_URL", "file:///fixture-secret"],
    ["DISCORD_WEBHOOK_URL", "http://user:fixture-secret@127.0.0.1/"],
    ["ENDPOINT", "not a URL with fixture-secret"],
    ["SECRET_ACCESS_KEY", " "],
    ["MONITOR_NAME", " "],
    ["RAILWAY_ENVIRONMENT_NAME", " "],
    ["RAILWAY_ENVIRONMENT_ID", " "],
    ["DISCORD_PRODUCTION_ENVIRONMENT_ID", " "],
    ["MONITOR_COOLDOWN_MINUTES", ""],
    ["MONITOR_COOLDOWN_MINUTES", " "],
    ["MONITOR_COOLDOWN_MINUTES", "0"],
    ["MONITOR_COOLDOWN_MINUTES", "-1"],
    ["MONITOR_COOLDOWN_MINUTES", "1.5"],
    ["MONITOR_COOLDOWN_MINUTES", "NaN"],
    ["MONITOR_COOLDOWN_MINUTES", "9007199254740992"],
    ["MONITOR_COOLDOWN_MINUTES", "150119987580"],
  ]) {
    const { stdout } = await run(t, remote, "Invalid indexer monitor configuration.", {
      ...remote.env,
      [name]: value,
    });
    assert.equal(stdout, "");
  }
  assert.deepEqual(remote.calls, []);
});

test("separate cron runs enforce the persisted cooldown before and after recovery", async (t) => {
  const remote = await fixture(t);
  const outage = "Protocol Indexer / preview: metrics are unreachable.";
  const recovery = "Protocol Indexer / preview: metrics are reachable again.";
  const content = () => remote.posts.map((post) => post.content);
  const started = Date.now();
  assert.equal((await run(t, remote)).stdout, outageAck);
  assert.deepEqual(remote.calls, [
    `GET ${statePath}`,
    "GET /metrics",
    "POST /webhook",
    `PUT ${statePath}`,
  ]);
  assert.deepEqual(content(), [outage]);
  assertEmbed(
    remote.posts[0],
    {
      title: "Indexer metrics outage",
      color: 0xe74c3c,
      fields: [
        { name: "Project", value: "Protocol Indexer / preview" },
        { name: "Status", value: "Unreachable" },
      ],
    },
    started,
  );
  assert.equal(remote.state.alertedDown, true);
  assert(remote.state.lastErrorAt >= started && remote.state.lastErrorAt <= Date.now());

  remote.calls.length = 0;
  const recent = { lastErrorAt: Date.now() - 59 * minute, alertedDown: true };
  remote.state = recent;
  const withinCooldown = await run(t, remote);
  assert.deepEqual(remote.calls, [`GET ${statePath}`, "GET /metrics"]);
  assert.deepEqual(remote.state, recent);
  assert.deepEqual(content(), [outage]);
  assert.equal(withinCooldown.stdout, suppressed);

  const stale = Date.now() - 61 * minute;
  remote.state = { lastErrorAt: stale, alertedDown: true };
  assert.equal((await run(t, remote)).stdout, outageAck);
  assert.deepEqual(content(), [outage, outage]);
  const acknowledged = remote.state.lastErrorAt;
  assert(acknowledged > stale);

  remote.metricsStatus = 204;
  assert.equal((await run(t, remote)).stdout, recoveryAck);
  assert.deepEqual(content(), [outage, outage, recovery]);
  assertEmbed(
    remote.posts[2],
    {
      title: "Indexer metrics recovered",
      color: 0x2ecc71,
      fields: [
        { name: "Project", value: "Protocol Indexer / preview" },
        { name: "Status", value: "Reachable again" },
      ],
    },
    acknowledged,
  );
  assert.deepEqual(remote.state, { lastErrorAt: acknowledged, alertedDown: false });
  assert.equal((await run(t, remote)).stdout, reachable);
  assert.deepEqual(content(), [outage, outage, recovery]);

  remote.metricsStatus = 503;
  assert.equal((await run(t, remote)).stdout, suppressed);
  assert.deepEqual(content(), [outage, outage, recovery]);
  assert.deepEqual(remote.state, { lastErrorAt: acknowledged, alertedDown: false });
});

test("configured cooldown controls suppression across separate invocations", async (t) => {
  const remote = await fixture(t);
  remote.env.MONITOR_COOLDOWN_MINUTES = "10";
  const recent = { lastErrorAt: Date.now() - 9 * minute, alertedDown: true };
  remote.state = recent;
  assert.equal((await run(t, remote)).stdout, suppressed);
  assert.deepEqual(remote.calls, [`GET ${statePath}`, "GET /metrics"]);
  assert.deepEqual(remote.state, recent);

  const older = Date.now() - 11 * minute;
  remote.state = { lastErrorAt: older, alertedDown: true };
  const eligible = await run(t, remote);
  assert.deepEqual(
    remote.posts.map((post) => post.content),
    ["Protocol Indexer / preview: metrics are unreachable."],
  );
  assert(remote.state.lastErrorAt > older);
  assert.equal(eligible.stdout, outageAck);
});

test("a fresh healthy cron run reads state and probes only metrics without writing", async (t) => {
  const remote = await fixture(t);
  remote.metricsStatus = 200;
  assert.equal((await run(t, remote)).stdout, reachable);
  assert.deepEqual(remote.calls, [`GET ${statePath}`, "GET /metrics"]);
  assert.deepEqual(remote.posts, []);
  assert.equal(remote.state, null);
});

test("failed delivery leaves state unchanged and the next run retries", async (t) => {
  const remote = await fixture(t);
  const before = { lastErrorAt: Date.now() - 61 * minute, alertedDown: false };
  remote.state = before;
  remote.webhookStatus = 429;
  const { MONITOR_NAME: _, ...env } = remote.env;
  const failed = await run(t, remote, "Indexer monitor webhook delivery failed.", env);
  assert.deepEqual(remote.state, before);
  assert.deepEqual(remote.calls, [`GET ${statePath}`, "GET /metrics", "POST /webhook"]);
  assert.equal(failed.stdout, unreachable);
  remote.webhookStatus = 204;
  assert.equal((await run(t, remote, "", env)).stdout, outageAck);
  assert.deepEqual(
    remote.posts.map((post) => post.content),
    ["Indexer: metrics are unreachable.", "Indexer: metrics are unreachable."],
  );
  assert.equal(remote.state.alertedDown, true);
  assert(remote.state.lastErrorAt > before.lastErrorAt);
});

test("corrupt state, AccessDenied and non-NoSuchKey 404s all fail before probing", async (t) => {
  const remote = await fixture(t);
  for (const state of [
    "fixture-secret",
    "null",
    "{}",
    { lastErrorAt: null, alertedDown: true },
    { lastErrorAt: -1, alertedDown: false },
    { lastErrorAt: 0.5, alertedDown: false },
    { lastErrorAt: Number.MAX_SAFE_INTEGER + 1, alertedDown: false },
    { lastErrorAt: 0, alertedDown: "false" },
  ]) {
    remote.state = state;
    assert.equal((await run(t, remote, "Indexer monitor state read failed.")).stdout, "");
  }
  for (const error of [
    [404, "NoSuchBucket"],
    [404, "NotFound"],
    [403, "AccessDenied"],
  ]) {
    remote.readError = error;
    assert.equal((await run(t, remote, "Indexer monitor state read failed.")).stdout, "");
  }
  assert.deepEqual(new Set(remote.calls), new Set([`GET ${statePath}`]));
  assert.equal(remote.calls.length, 11);
  assert.deepEqual(remote.posts, []);
});
test("Discord project fields stay within the limit without shortening content", async (t) => {
  const project = "p".repeat(1024);
  const name = `${project}z`;
  const remote = await fixture(t);
  remote.env.MONITOR_NAME = name;

  for (const [status, message] of [
    [503, "unreachable"],
    [200, "reachable again"],
  ]) {
    remote.metricsStatus = status;
    await run(t, remote);
    const payload = remote.posts.at(-1);
    assert.equal(payload.content, `${name}: metrics are ${message}.`);
    const field = payload.embeds[0].fields.find((field) => field.name === "Project");
    assert.equal(field.value.length, 1024);
    assert.equal(field.value, project);
  }
  assert.equal(remote.posts.length, 2);
});

test("a failed state write is reported after acknowledgement and permits redelivery", async (t) => {
  const remote = await fixture(t);
  remote.denyWrite = true;
  assert.equal((await run(t, remote, "Indexer monitor state write failed.")).stdout, outageAck);
  assert.equal(remote.posts.length, 1);
  assert.equal(remote.state, null);
  remote.denyWrite = false;
  assert.equal((await run(t, remote)).stdout, outageAck);
  assert.equal(remote.posts.length, 2);
  assert.equal(remote.state.alertedDown, true);
});

test("metrics redirects count as failed probes without following the target", async (t) => {
  const remote = await fixture(t);
  remote.metricsStatus = 302;
  assert.equal((await run(t, remote)).stdout, outageAck);
  assert.deepEqual(remote.calls, [
    `GET ${statePath}`,
    "GET /metrics",
    "POST /webhook",
    `PUT ${statePath}`,
  ]);
});

test("native deadlines bound metrics, webhook and slow-drip S3 response bodies", {
  concurrency: true,
}, async (t) => {
  await Promise.all([
    t.test("hung metrics is an unhealthy probe", async (t) => {
      const remote = await fixture(t);
      remote.hangMetrics = true;
      const { elapsed, stdout } = await run(t, remote);
      assert(elapsed >= 4_800 && elapsed < 7_500, `elapsed ${elapsed}ms`);
      assert.equal(stdout, outageAck);
      assert.equal(remote.posts.length, 1);
    }),
    t.test("hung webhook exits before a state write", async (t) => {
      const remote = await fixture(t);
      remote.hangWebhook = true;
      const { elapsed, stdout } = await run(t, remote, "Indexer monitor webhook delivery failed.");
      assert(elapsed >= 4_800 && elapsed < 7_500, `elapsed ${elapsed}ms`);
      assert.equal(stdout, unreachable);
      assert.equal(remote.state, null);
    }),
    t.test("headers and continual body bytes do not extend the S3 read", async (t) => {
      const remote = await fixture(t);
      remote.drip = true;
      const { elapsed, stdout } = await run(t, remote, "Indexer monitor state read failed.");
      assert(elapsed >= 4_800 && elapsed < 7_500, `elapsed ${elapsed}ms`);
      assert.equal(stdout, "");
      assert.deepEqual(remote.calls, [`GET ${statePath}`]);
    }),
  ]);
});

test("SIGTERM aborts a hung probe without posting an alert", async (t) => {
  const remote = await fixture(t);
  remote.hangMetrics = true;
  const { child, result } = start(t, remote.env);
  const deadline = performance.now() + 2_500;
  while (!remote.calls.includes("GET /metrics")) {
    assert(performance.now() < deadline, "metrics probe never started");
    await setTimeout(10);
  }
  child.kill("SIGTERM");
  const { elapsed, ...exit } = await result();
  assert(elapsed < 4_000, `elapsed ${elapsed}ms`);
  assert.deepEqual(exit, { code: 0, signal: null, stdout: "", stderr: "" });
  assert.deepEqual(remote.posts, []);
});
