import { addAbortSignal, Readable } from "node:stream";
import {
  GetObjectCommand,
  type GetObjectCommandInput,
  type GetObjectCommandOutput,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const stateKey = "indexer-monitor/state.json";

type MonitorState = { lastErrorAt: number | null; alertedDown: boolean };
type DiscordPayload = {
  content: string;
  embeds: [
    {
      title: string;
      color: number;
      fields: { name: string; value: string }[];
      timestamp: string;
    },
  ];
};

function httpUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error();
  }
  return url.href;
}

function configuration(env: NodeJS.ProcessEnv) {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error();
    return value;
  };
  const environment = env.RAILWAY_ENVIRONMENT_NAME;
  if (environment !== undefined && !environment.trim()) throw new Error();
  const runtimeId =
    env.RAILWAY_ENVIRONMENT_ID === undefined ? undefined : required("RAILWAY_ENVIRONMENT_ID");
  if (runtimeId !== undefined && environment === undefined) throw new Error();
  const preview = environment !== undefined && environment !== "production";
  const name = env.MONITOR_NAME === undefined ? "Indexer" : required("MONITOR_NAME");
  const cooldown = env.MONITOR_COOLDOWN_MINUTES ?? "60";
  const minutes = Number(cooldown);
  const cooldownMs = minutes * 60_000;
  if (
    !/^\d+$/.test(cooldown) ||
    !Number.isSafeInteger(minutes) ||
    minutes < 1 ||
    !Number.isSafeInteger(cooldownMs)
  ) {
    throw new Error();
  }
  return {
    metricsUrl: httpUrl(required("INDEXER_METRICS_URL")),
    webhookUrl: httpUrl(required(preview ? "DISCORD_WEBHOOK_URL_PREVIEW" : "DISCORD_WEBHOOK_URL")),
    name: preview ? `${name} / ${environment}` : name,
    cooldownMs,
    bucket: required("BUCKET"),
    endpoint: httpUrl(required("ENDPOINT")),
    region: required("REGION"),
    credentials: {
      accessKeyId: required("ACCESS_KEY_ID"),
      secretAccessKey: required("SECRET_ACCESS_KEY"),
    },
  };
}

function requestDeadline(shutdown: AbortSignal) {
  return AbortSignal.any([shutdown, AbortSignal.timeout(5_000)]);
}

async function readState(
  client: S3Client,
  object: GetObjectCommandInput,
  shutdown: AbortSignal,
): Promise<MonitorState> {
  const signal = requestDeadline(shutdown);
  let body: GetObjectCommandOutput["Body"];
  try {
    ({ Body: body } = await client.send(new GetObjectCommand(object), { abortSignal: signal }));
  } catch (error) {
    if (error instanceof NoSuchKey) return { lastErrorAt: null, alertedDown: false };
    throw error;
  }

  // The SDK returns after headers. Keep the same deadline active for the body.
  if (!(body instanceof Readable)) throw new Error();
  const state: unknown = JSON.parse(await addAbortSignal(signal, body).transformToString());
  if (
    !state ||
    typeof state !== "object" ||
    !("lastErrorAt" in state) ||
    !("alertedDown" in state)
  ) {
    throw new Error();
  }
  const { lastErrorAt, alertedDown } = state;
  if (
    (lastErrorAt !== null &&
      (typeof lastErrorAt !== "number" || !Number.isSafeInteger(lastErrorAt) || lastErrorAt < 0)) ||
    typeof alertedDown !== "boolean" ||
    (alertedDown && lastErrorAt === null)
  ) {
    throw new Error();
  }
  return { lastErrorAt, alertedDown };
}

async function requestSucceeded(url: string, shutdown: AbortSignal, options?: RequestInit) {
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

function fail(message: string) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  let settings: ReturnType<typeof configuration>;
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
  const { bucket, endpoint, region, credentials, metricsUrl, webhookUrl, name, cooldownMs } =
    settings;
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
    const status = healthy ? "Reachable again" : "Unreachable";
    const payload: DiscordPayload = {
      content: `${name}: metrics are ${status.toLowerCase()}.`,
      embeds: [
        {
          title: healthy ? "Indexer metrics recovered" : "Indexer metrics outage",
          color: healthy ? 0x2ecc71 : 0xe74c3c,
          fields: [
            { name: "Project", value: name.slice(0, 1024) },
            { name: "Status", value: status },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    };
    const delivered = await requestSucceeded(webhookUrl, signal, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
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
