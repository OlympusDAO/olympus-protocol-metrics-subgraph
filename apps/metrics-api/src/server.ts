import type { IncomingMessage, ServerResponse } from "node:http";

export type MetricsApiConfig = {
  maxRangeDays: number;
};

export async function handleMetricsApiRequest(
  _req: IncomingMessage,
  res: ServerResponse,
  _config: MetricsApiConfig,
): Promise<void> {
  res.statusCode = 501;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: { code: "not_implemented", message: "Not implemented" } }));
}
