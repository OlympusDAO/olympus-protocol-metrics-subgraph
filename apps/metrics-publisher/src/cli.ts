#!/usr/bin/env node

import { publishMetricsArtifactsFromEnv } from "./publisher";

const result = await publishMetricsArtifactsFromEnv();

console.log(
  JSON.stringify({
    range: result.range,
    writtenKeys: result.writtenKeys,
    manifestPublishedLast: result.manifestPublishedLast,
  }),
);
