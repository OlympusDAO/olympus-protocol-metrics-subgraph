import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const entrypoint = fileURLToPath(
  new URL("../../apps/indexer/src/monitor-indexer.mjs", import.meta.url),
);

async function listen(context, handler) {
  const server = createServer(handler);
  context.onTestFinished(async () => {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

function start(context, env) {
  const child = spawn(process.execPath, [entrypoint], {
    env: { MONITOR_INTERVAL_SECONDS: "1", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr += chunk;
  });
  const result = once(child, "close").then(([code, signal]) => ({ code, signal, stdout, stderr }));
  context.onTestFinished(async () => {
    child.kill("SIGKILL");
    await result;
  });
  return { child, result };
}

async function endpoints(
  context,
  metrics,
  deliver = (_request, response) => response.writeHead(204).end(),
  healthcheck = (response) => response.writeHead(200).end(),
) {
  const requests = [];
  const probes = [];
  const messages = [];
  const metricsHost = await listen(context, (request, response) => {
    requests.push([request.url, request.method]);
    if (request.url === "/healthz") {
      healthcheck(response);
      return;
    }
    if (request.url !== "/metrics") {
      response.writeHead(503).end("catching up");
      return;
    }
    probes.push({
      path: request.url,
      method: request.method,
      time: performance.now(),
      messages: messages.length,
    });
    metrics(response, probes.length);
  });
  const webhookHost = await listen(context, (request, response) => {
    const body = [];
    request.setEncoding("utf8").on("data", (chunk) => body.push(chunk));
    request.on("end", () => {
      messages.push({
        method: request.method,
        type: request.headers["content-type"],
        path: request.url,
        body: body.join(""),
      });
      deliver(request, response);
    });
  });
  return {
    requests,
    probes,
    messages,
    env: {
      INDEXER_METRICS_URL: `${metricsHost}/metrics`,
      DISCORD_WEBHOOK_URL: `${webhookHost}/webhook?secret=fixture`,
    },
  };
}

test("invalid or missing configuration exits before any HTTP requests", async (context) => {
  const fixture = await endpoints(context, (response) => response.writeHead(200).end());
  for (const override of [
    { INDEXER_METRICS_URL: undefined },
    { DISCORD_WEBHOOK_URL: undefined },
    { DISCORD_WEBHOOK_URL: "file:///fixture-secret" },
    { INDEXER_METRICS_URL: "not a URL with a fixture-secret" },
    { MONITOR_INTERVAL_SECONDS: "0" },
    { MONITOR_INTERVAL_SECONDS: "1.5" },
    { MONITOR_INTERVAL_SECONDS: "2147484" },
  ]) {
    const { result } = start(context, { ...fixture.env, ...override });
    await expect(result).resolves.toEqual({
      code: 1,
      signal: null,
      stdout: "",
      stderr: "Invalid indexer monitor configuration.\n",
    });
  }
  expect(fixture.requests).toEqual([]);
  expect(fixture.messages).toEqual([]);
});

test("CLI alerts on the second consecutive failure and recovers once during backfill", async (context) => {
  const statuses = [200, 503, 200, 503, 503, 503, 204, 200];
  const fixture = await endpoints(context, (response, n) =>
    response.writeHead(statuses[n - 1] ?? 200).end(),
  );
  const { child, result } = start(context, { ...fixture.env, MONITOR_NAME: "Metrics (staging)" });
  await expect.poll(() => fixture.probes.length, { timeout: 11_000 }).toBe(statuses.length);
  child.kill("SIGTERM");
  await expect(result).resolves.toEqual({
    code: 0,
    signal: null,
    stdout:
      "Indexer monitor started.\nIndexer monitor reported indexer unavailable.\nIndexer monitor reported indexer available again.\nIndexer monitor stopped.\n",
    stderr: "",
  });

  expect(fixture.requests.length).toBeGreaterThan(fixture.probes.length);
  expect(
    fixture.requests.every(
      ([path, method]) => ["/metrics", "/healthz"].includes(path) && method === "GET",
    ),
  ).toBe(true);
  expect(fixture.probes.map(({ path, method }) => [path, method])).toEqual(
    statuses.map(() => ["/metrics", "GET"]),
  );
  expect(fixture.probes.map(({ messages }) => messages)).toEqual([0, 0, 0, 0, 0, 1, 1, 2]);
  expect(
    fixture.messages.map(({ method, type, path, body }) => [method, type, path, JSON.parse(body)]),
  ).toEqual([
    [
      "POST",
      "application/json",
      "/webhook?secret=fixture",
      { content: "Metrics (staging): indexer is unavailable." },
    ],
    [
      "POST",
      "application/json",
      "/webhook?secret=fixture",
      { content: "Metrics (staging): indexer is available again." },
    ],
  ]);
}, 14_000);

for (const mode of ["HTTP error", "timeout"]) {
  test(`webhook ${mode} retries without stopping probes or duplicating delivered alerts`, async (context) => {
    let deliveryStarted;
    let deliveryStopped;
    const fixture = await endpoints(
      context,
      (response, n) => response.writeHead(n < 5 || n === 6 ? 503 : 200).end(),
      (_request, response) => {
        const attempt = fixture.messages.length;
        if (attempt === 1) {
          deliveryStarted = performance.now();
          if (mode === "HTTP error") response.writeHead(429).end("fixture-secret response body");
          else
            response.once("close", () => {
              deliveryStopped = performance.now();
            });
        } else if (attempt === 3) response.writeHead(429).end("fixture-secret response body");
        else response.writeHead(204).end();
      },
    );
    const { child, result } = start(context, fixture.env);
    await expect.poll(() => fixture.probes.length, { timeout: 15_000 }).toBe(8);
    child.kill("SIGTERM");
    await expect(result).resolves.toEqual({
      code: 0,
      signal: null,
      stdout:
        "Indexer monitor started.\nIndexer monitor reported indexer unavailable.\nIndexer monitor reported indexer available again.\nIndexer monitor stopped.\n",
      stderr: "Indexer monitor webhook delivery failed.\n".repeat(2),
    });
    expect(fixture.probes.map(({ messages }) => messages)).toEqual([0, 0, 1, 2, 2, 3, 3, 4]);
    expect(fixture.messages.map(({ body }) => JSON.parse(body))).toEqual(
      ["unavailable", "unavailable", "available again", "available again"].map((status) => ({
        content: `Indexer: indexer is ${status}.`,
      })),
    );
    if (mode === "timeout") expect(deliveryStopped - deliveryStarted).toBeGreaterThanOrEqual(4_500);
  }, 17_000);
}

test("healthcheck rejection alerts even while metrics stay available", async (context) => {
  const statuses = [200, 401, 503, 503, 200, 200];
  let healthchecks = 0;
  const fixture = await endpoints(
    context,
    (response) => response.writeHead(200).end(),
    undefined,
    (response) => response.writeHead(statuses[healthchecks++] ?? 200).end("fixture-secret body"),
  );
  const { child, result } = start(context, fixture.env);
  await expect
    .poll(() => Math.min(healthchecks, fixture.probes.length), { timeout: 9_000 })
    .toBe(statuses.length);
  child.kill("SIGTERM");
  await expect(result).resolves.toEqual({
    code: 0,
    signal: null,
    stdout:
      "Indexer monitor started.\nIndexer monitor reported indexer unavailable.\nIndexer monitor reported indexer available again.\nIndexer monitor stopped.\n",
    stderr: "",
  });
  expect(fixture.messages.map(({ body }) => JSON.parse(body))).toEqual([
    { content: "Indexer: indexer is unavailable." },
    { content: "Indexer: indexer is available again." },
  ]);
}, 11_000);

for (const target of ["metrics", "healthz"]) {
  test(`a hung ${target} probe times out and SIGINT aborts the next probe without an alert`, async (context) => {
    let disconnected = 0;
    const hang = (response) =>
      response.on("close", () => {
        disconnected++;
      });
    const fixture = await endpoints(
      context,
      target === "metrics" ? hang : (response) => response.writeHead(200).end(),
      undefined,
      target === "healthz" ? hang : undefined,
    );
    const { child, result } = start(context, fixture.env);
    await expect
      .poll(
        () =>
          Math.min(
            fixture.probes.length,
            fixture.requests.filter(([path]) => path === `/${target}`).length,
          ),
        { timeout: 9_000 },
      )
      .toBe(2);
    const elapsed = fixture.probes[1].time - fixture.probes[0].time;
    expect(elapsed).toBeGreaterThanOrEqual(5_500);
    expect(disconnected).toBe(1);
    child.kill("SIGINT");
    await expect(result).resolves.toEqual({
      code: 0,
      signal: null,
      stdout: "Indexer monitor started.\nIndexer monitor stopped.\n",
      stderr: "",
    });
    await expect.poll(() => disconnected).toBe(2);
    expect(fixture.messages).toEqual([]);
  }, 12_000);
}
