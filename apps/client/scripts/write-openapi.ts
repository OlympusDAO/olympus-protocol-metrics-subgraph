import { writeFileSync } from "node:fs";

import { getOpenApiDocument } from "../../../packages/metrics-artifacts/src/index.js";

const outputUrl = new URL("../openapi.json", import.meta.url);

writeFileSync(outputUrl, `${JSON.stringify(getOpenApiDocument(), null, 2)}\n`);
