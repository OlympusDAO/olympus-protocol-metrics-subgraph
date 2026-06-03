import { createArtifactReaderFromEnv } from "./artifact-store";
import type { MetricsApiConfig } from "./server";

export function metricsApiPortFromEnv(env: NodeJS.ProcessEnv): number {
  const port = Number(env.PORT ?? env.METRICS_API_PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT or METRICS_API_PORT must be a valid TCP port.");
  }
  return port;
}

export function metricsApiConfigFromEnv(env: NodeJS.ProcessEnv): MetricsApiConfig {
  const maxRangeDays = Number(env.METRICS_API_MAX_RANGE_DAYS ?? "366");
  if (!Number.isInteger(maxRangeDays) || maxRangeDays < 1) {
    throw new Error("METRICS_API_MAX_RANGE_DAYS must be a positive integer.");
  }
  return {
    maxRangeDays,
    artifactReader: createArtifactReaderFromEnv(env),
  };
}
