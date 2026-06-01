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
        build: { dockerfilePath: string; watchPatterns: string[] };
      };
      expect(config.build.dockerfilePath).toBe(dockerfilePath);
      expect(config.build.watchPatterns).toContain(configPath);
      expect(config.build.watchPatterns).toContain(dockerfilePath);
      expect(existsSync(dockerfilePath)).toBe(true);
    }
  });

  test("configures service deploy behavior", () => {
    const publisher = JSON.parse(readFileSync("railway-metrics-publisher.json", "utf8")) as {
      build: { watchPatterns: string[] };
      deploy: { cronSchedule: string; restartPolicyType: string };
    };
    const api = JSON.parse(readFileSync("railway-metrics-api.json", "utf8")) as {
      deploy: { healthcheckPath: string; restartPolicyType: string };
    };

    expect(publisher.deploy.cronSchedule).toBe("15 * * * *");
    expect(publisher.deploy.restartPolicyType).toBe("NEVER");
    expect(publisher.build.watchPatterns).toContain("apps/indexer/**");
    expect(publisher.build.watchPatterns).toContain("apps/metrics-publisher/**");
    expect(publisher.build.watchPatterns).toContain("packages/metrics-artifacts/**");
    expect(api.deploy.healthcheckPath).toBe("/ready");
    expect(api.deploy.restartPolicyType).toBe("ALWAYS");
  });

  test("configures service watch patterns by runtime ownership", () => {
    const indexer = JSON.parse(readFileSync("railway-indexer.json", "utf8")) as {
      build: { watchPatterns: string[] };
    };
    const hasura = JSON.parse(readFileSync("railway-hasura.json", "utf8")) as {
      build: { watchPatterns: string[] };
    };
    const api = JSON.parse(readFileSync("railway-metrics-api.json", "utf8")) as {
      build: { watchPatterns: string[] };
    };
    const publisher = JSON.parse(readFileSync("railway-metrics-publisher.json", "utf8")) as {
      build: { watchPatterns: string[] };
    };

    expect(hasura.build.watchPatterns).toEqual(["Dockerfile-hasura", "railway-hasura.json"]);
    expect(indexer.build.watchPatterns).toContain("apps/indexer/**");
    expect(api.build.watchPatterns).toContain("apps/metrics-api/**");
    expect(api.build.watchPatterns).toContain("packages/metrics-artifacts/**");
    expect(publisher.build.watchPatterns).toContain("apps/indexer/**");
    expect(publisher.build.watchPatterns).toContain("Dockerfile-indexer");
    expect(publisher.build.watchPatterns).toContain("railway-indexer.json");
    expect(publisher.build.watchPatterns).toContain("apps/metrics-publisher/**");
    expect(publisher.build.watchPatterns).toContain("packages/metrics-artifacts/**");

    for (const config of [indexer, api, publisher]) {
      expect(config.build.watchPatterns).toContain("package.json");
      expect(config.build.watchPatterns).toContain("pnpm-lock.yaml");
      expect(config.build.watchPatterns).toContain("pnpm-workspace.yaml");
      expect(config.build.watchPatterns).toContain("tsconfig.json");
    }
  });

  test("documents required Railway variables and public exposure rules", () => {
    const doc = readFileSync("docs/railway-metrics-api.md", "utf8");

    for (const variable of [
      "DATABASE_URL",
      "ENVIO_PG_HOST",
      "HASURA_GRAPHQL_ADMIN_SECRET",
      "ENVIO_ETHEREUM_RPC_URL",
      "ENVIO_ARBITRUM_RPC_URL",
      "ARTIFACT_BUCKET",
      "ARTIFACT_ACCESS_KEY_ID",
      "ARTIFACT_SECRET_ACCESS_KEY",
      "METRICS_API_MAX_RANGE_DAYS",
      "INDEXER_DEPLOYMENT_ID",
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
      expect(content).toContain("apt-get install -y --no-install-recommends ca-certificates");
      expect(content).toContain("COREPACK_HOME=/corepack");
      expect(content).toContain("pnpm --version");
      expect(content).toContain("pnpm install --frozen-lockfile");
      expect(content).not.toContain("node\", \"--version");
      expect(content).toContain("USER node");
    }

    expect(readFileSync("Dockerfile-indexer", "utf8")).toContain("envio:start");
    expect(readFileSync("Dockerfile-indexer", "utf8")).toContain("chown -R node:node apps/indexer/.envio");
    expect(readFileSync("Dockerfile-metrics-api", "utf8")).toContain("apps/metrics-api");
    expect(readFileSync("Dockerfile-metrics-publisher", "utf8")).toContain("apps/metrics-publisher");
  });
});
