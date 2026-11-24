import { setTimeout } from "node:timers/promises";

const failureThreshold = 2;
const requestTimeoutMs = 5_000;
// Node's timers are limited to a signed 32-bit millisecond delay.
const maxTimerSeconds = 2_147_483;

function httpUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error();
  }
  return url;
}

function config(env) {
  const interval = env.MONITOR_INTERVAL_SECONDS ?? "60";
  const intervalSeconds = Number(interval);
  if (!/^\d+$/.test(interval) || intervalSeconds < 1 || intervalSeconds > maxTimerSeconds) {
    throw new Error();
  }
  return {
    metricsUrl: httpUrl(env.INDEXER_METRICS_URL),
    webhookUrl: httpUrl(env.DISCORD_WEBHOOK_URL),
    name: env.MONITOR_NAME?.trim() || "Indexer",
    intervalSeconds,
  };
}

async function requestSucceeded(url, shutdown, options) {
  try {
    const response = await fetch(url, {
      ...options,
      redirect: "manual",
      signal: AbortSignal.any([shutdown, AbortSignal.timeout(requestTimeoutMs)]),
    });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  let settings;
  try {
    settings = config(process.env);
  } catch {
    console.error("Invalid indexer monitor configuration.");
    process.exitCode = 1;
    return;
  }

  const { metricsUrl, webhookUrl, name, intervalSeconds } = settings;
  const healthUrl = new URL("/healthz", metricsUrl);
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.info("Indexer monitor started.");
  const { signal } = shutdown;
  let failures = 0;
  let alertedDown = false;
  while (!signal.aborted) {
    const healthy = (
      await Promise.all([requestSucceeded(metricsUrl, signal), requestSucceeded(healthUrl, signal)])
    ).every(Boolean);
    if (signal.aborted) break;

    failures = healthy ? 0 : Math.min(failures + 1, failureThreshold);
    const isDown = failures === failureThreshold;
    if ((isDown && !alertedDown) || (healthy && alertedDown)) {
      const status = isDown ? "unavailable" : "available again";
      const delivered = await requestSucceeded(webhookUrl, signal, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: `${name}: indexer is ${status}.` }),
      });
      if (signal.aborted) break;
      if (!delivered) {
        console.error("Indexer monitor webhook delivery failed.");
      } else {
        alertedDown = isDown;
        console.info(`Indexer monitor reported indexer ${status}.`);
      }
    }
    await setTimeout(intervalSeconds * 1_000, undefined, { signal }).catch(() => {});
  }
  console.info("Indexer monitor stopped.");
}

await main();
