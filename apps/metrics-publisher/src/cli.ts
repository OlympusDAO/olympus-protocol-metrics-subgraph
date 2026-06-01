#!/usr/bin/env node

import { publishMetricsArtifactsFromEnv } from "./publisher";

const result = await publishMetricsArtifactsFromEnv();

console.log(
  JSON.stringify({
    skipped: result.skipped,
    skipReason: result.skipReason,
    publishMode: result.publishMode,
    runId: result.runId,
    range: result.range,
    writtenKeys: result.writtenKeys,
    manifestPublishedLast: result.manifestPublishedLast,
  }),
);
