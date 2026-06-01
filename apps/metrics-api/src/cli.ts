#!/usr/bin/env node

import { createServer } from "node:http";
import { handleMetricsApiRequest } from "./server";

const port = Number(process.env.PORT ?? process.env.METRICS_API_PORT ?? "3000");
const maxRangeDays = Number(process.env.METRICS_API_MAX_RANGE_DAYS ?? "366");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT or METRICS_API_PORT must be a valid TCP port.");
}

if (!Number.isInteger(maxRangeDays) || maxRangeDays < 1) {
  throw new Error("METRICS_API_MAX_RANGE_DAYS must be a positive integer.");
}

const server = createServer((req, res) => {
  void handleMetricsApiRequest(req, res, { maxRangeDays });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`metrics-api listening on :${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
