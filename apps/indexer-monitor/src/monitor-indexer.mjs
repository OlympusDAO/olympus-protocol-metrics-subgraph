import { addAbortSignal } from "node:stream";
import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const stateKey = "indexer-monitor/state.json";
const cooldownMs = 60 * 60_000;

function httpUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error();
  }
  return url.href;
}

function configuration(env) {
  const required = (name) => {
    const value = env[name]?.trim();
    if (!value) throw new Error();
    return value;
  };
  return {
    metricsUrl: httpUrl(required("INDEXER_METRICS_URL")),
    webhookUrl: httpUrl(required("DISCORD_WEBHOOK_URL")),
    name: env.MONITOR_NAME === undefined ? "Indexer" : required("MONITOR_NAME"),
    bucket: required("BUCKET"),
    endpoint: httpUrl(required("ENDPOINT")),
    region: required("REGION"),
    credentials: {
      accessKeyId: required("ACCESS_KEY_ID"),
      secretAccessKey: required("SECRET_ACCESS_KEY"),
    },
  };
}

function requestDeadline(shutdown) {
  return AbortSignal.any([shutdown, AbortSignal.timeout(5_000)]);
}

async function readState(client, object, shutdown) {
  const signal = requestDeadline(shutdown);
  let body;
  try {
    ({ Body: body } = await client.send(new GetObjectCommand(object), { abortSignal: signal }));
  } catch (error) {
    if (error instanceof NoSuchKey) return { lastErrorAt: null, alertedDown: false };
    throw error;
  }

  // The SDK returns after headers. Keep the same deadline active for the body.
  const state = JSON.parse(await addAbortSignal(signal, body).transformToString());
  const { lastErrorAt, alertedDown } = state;
  if (
    (lastErrorAt !== null && (!Number.isSafeInteger(lastErrorAt) || lastErrorAt < 0)) ||
    typeof alertedDown !== "boolean" ||
    (alertedDown && lastErrorAt === null)
  ) {
    throw new Error();
  }
  return state;
}

async function requestSucceeded(url, shutdown, options) {
  try {
    const response = await fetch(url, {
      ...options,
      redirect: "manual",
      signal: requestDeadline(shutdown),
    });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  let settings;
  try {
    settings = configuration(process.env);
  } catch {
    fail("Invalid indexer monitor configuration.");
    return;
  }

  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const { signal } = shutdown;
  const { bucket, endpoint, region, credentials, metricsUrl, webhookUrl, name } = settings;
  const client = new S3Client({
    endpoint,
    region,
    credentials,
    forcePathStyle: true,
    maxAttempts: 1,
  });
  const object = { Bucket: bucket, Key: stateKey };
  let operation = "state read";

  try {
    const state = await readState(client, object, signal);
    signal.throwIfAborted();
    const healthy = await requestSucceeded(metricsUrl, signal);
    signal.throwIfAborted();

    const notify = healthy
      ? state.alertedDown
      : state.lastErrorAt === null || Date.now() - state.lastErrorAt >= cooldownMs;
    const result = healthy ? "reachable" : "unreachable";
    const suppressed = !healthy && !notify ? " Error notification suppressed by cooldown." : "";
    console.log(`Indexer monitor metrics ${result}.${suppressed}`);
    if (!notify) return;

    operation = "webhook delivery";
    const status = healthy ? "reachable again" : "unreachable";
    const delivered = await requestSucceeded(webhookUrl, signal, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: `${name}: metrics are ${status}.` }),
    });
    signal.throwIfAborted();
    if (!delivered) throw new Error();
    console.log(
      healthy
        ? "Indexer monitor recovery notification acknowledged."
        : "Indexer monitor outage notification acknowledged.",
    );

    operation = "state write";
    await client.send(
      new PutObjectCommand({
        ...object,
        Body: JSON.stringify({
          lastErrorAt: healthy ? state.lastErrorAt : Date.now(),
          alertedDown: !healthy,
        }),
        ContentType: "application/json",
      }),
      { abortSignal: requestDeadline(signal) },
    );
  } catch {
    if (!signal.aborted) fail(`Indexer monitor ${operation} failed.`);
  } finally {
    client.destroy();
  }
}

await main();
