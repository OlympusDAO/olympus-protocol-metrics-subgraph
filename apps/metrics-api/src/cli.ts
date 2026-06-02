#!/usr/bin/env node

import { createServer } from "node:http";
import { metricsApiConfigFromEnv, metricsApiPortFromEnv } from "./config";
import { handleMetricsApiRequest } from "./server";

// The API intentionally uses Node's built-in HTTP server. The public surface is
// a small GET/HEAD/OPTIONS REST API, and avoiding Express keeps the runtime
// dependency and middleware surface smaller.
const port = metricsApiPortFromEnv(process.env);
const config = metricsApiConfigFromEnv(process.env);

const server = createServer((req, res) => {
  void handleMetricsApiRequest(req, res, config);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`metrics-api listening on :${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
