#!/usr/bin/env node

import { publishMetricsArtifactsFromEnv } from "./publisher";

const result = await publishMetricsArtifactsFromEnv();

console.log(
  JSON.stringify({
    skipped: result.skipped,
    skipReason: result.skipReason,
    runId: result.runId,
    range: result.range,
    writtenKeys: result.writtenKeys,
    deletedKeys: result.deletedKeys,
    manifestPublishedLast: result.manifestPublishedLast,
  }),
);
