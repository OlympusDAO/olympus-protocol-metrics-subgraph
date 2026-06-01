import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Railway config-as-code", () => {
  test("defines expected service configs and Dockerfile paths", () => {
    for (const [configPath, dockerfilePath] of [
      ["railway-indexer.json", "Dockerfile-indexer"],
      ["railway-hasura.json", "Dockerfile-hasura"],
      ["railway-metrics-publisher.json", "Dockerfile-metrics-publisher"],
      ["railway-metrics-api.json", "Dockerfile-metrics-api"],
    ] as const) {
      const config = JSON.parse(readFileSync(configPath, "utf8")) as {
        build: { dockerfilePath: string };
      };
      expect(config.build.dockerfilePath).toBe(dockerfilePath);
      expect(existsSync(dockerfilePath)).toBe(true);
    }
  });

  test("configures publisher cron and API readiness healthcheck", () => {
    const publisher = JSON.parse(readFileSync("railway-metrics-publisher.json", "utf8")) as {
      deploy: { cronSchedule: string; restartPolicyType: string };
    };
    const api = JSON.parse(readFileSync("railway-metrics-api.json", "utf8")) as {
      deploy: { healthcheckPath: string; restartPolicyType: string };
    };

    expect(publisher.deploy.cronSchedule).toBe("15 * * * *");
    expect(publisher.deploy.restartPolicyType).toBe("NEVER");
    expect(api.deploy.healthcheckPath).toBe("/ready");
    expect(api.deploy.restartPolicyType).toBe("ALWAYS");
  });

  test("documents required Railway variables and public exposure rules", () => {
    const doc = readFileSync("docs/railway-metrics-api.md", "utf8");

    for (const variable of [
      "DATABASE_URL",
      "HASURA_GRAPHQL_ADMIN_SECRET",
      "RPC_URL_1",
      "ARTIFACT_BUCKET",
      "ARTIFACT_ACCESS_KEY_ID",
      "ARTIFACT_SECRET_ACCESS_KEY",
      "METRICS_API_MAX_RANGE_DAYS",
      "PUBLISHER_MODE",
    ]) {
      expect(doc).toContain(variable);
    }

    expect(doc).toContain("Only `metrics-api` should receive a public Railway domain");
    expect(doc).toContain("Cloudflare");
    expect(doc).toContain("WAF");
  });

  test("uses pinned production Dockerfiles with real service commands", () => {
    for (const dockerfile of ["Dockerfile-indexer", "Dockerfile-metrics-api", "Dockerfile-metrics-publisher"]) {
      const content = readFileSync(dockerfile, "utf8");
      expect(content).toContain("@sha256:");
      expect(content).toContain("pnpm install --frozen-lockfile");
      expect(content).not.toContain("node\", \"--version");
      expect(content).toContain("USER node");
    }

    expect(readFileSync("Dockerfile-indexer", "utf8")).toContain("envio:start");
    expect(readFileSync("Dockerfile-metrics-api", "utf8")).toContain("apps/metrics-api");
    expect(readFileSync("Dockerfile-metrics-publisher", "utf8")).toContain("apps/metrics-publisher");
  });
});
