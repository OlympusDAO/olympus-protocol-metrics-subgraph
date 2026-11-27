import { readFileSync, writeFileSync } from "node:fs";

import { getOpenApiDocument } from "../../../packages/metrics-artifacts/src/index.js";

const outputUrl = new URL("../openapi.json", import.meta.url);

const output = `${JSON.stringify(getOpenApiDocument(), null, 2)}\n`;
if (process.argv[2] === "--check") {
  if (readFileSync(outputUrl, "utf8").replace(/\r\n/g, "\n") !== output)
    throw new Error("OpenAPI document is stale; run pnpm --dir apps/client generate:openapi.");
} else {
  writeFileSync(outputUrl, output);
}
