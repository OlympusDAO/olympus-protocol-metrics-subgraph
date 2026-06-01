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
});
