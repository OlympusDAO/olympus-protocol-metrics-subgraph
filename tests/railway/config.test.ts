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
    const hasura = JSON.parse(readFileSync("railway-hasura.json", "utf8")) as {
      deploy: { healthcheckPath: string; restartPolicyType: string };
    };
    const indexer = JSON.parse(readFileSync("railway-indexer.json", "utf8")) as {
      deploy: { healthcheckPath: string; restartPolicyType: string };
    };

    expect(publisher.deploy.cronSchedule).toBe("15 * * * *");
    expect(publisher.deploy.restartPolicyType).toBe("NEVER");
    expect(publisher.build.watchPatterns).toContain("apps/indexer/**");
    expect(publisher.build.watchPatterns).toContain("apps/metrics-publisher/**");
    expect(publisher.build.watchPatterns).toContain("packages/metrics-artifacts/**");
    expect(hasura.deploy.healthcheckPath).toBe("/healthz");
    expect(hasura.deploy.restartPolicyType).toBe("ALWAYS");
    expect(indexer.deploy.healthcheckPath).toBe("/healthz");
    expect(indexer.deploy.restartPolicyType).toBe("ALWAYS");
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

    expect(doc).toContain("copies Railway's runtime `RAILWAY_DEPLOYMENT_ID` into `ENVIO_PG_SCHEMA`");
    expect(doc).toContain("indexer startup wrapper derives `ENVIO_INDEXER_PORT`");
    expect(doc).toContain("${{hasura.RAILWAY_PRIVATE_DOMAIN}}:${{hasura.PORT}}/v1/graphql");
    expect(doc).toContain("${{hasura.RAILWAY_PRIVATE_DOMAIN}}:${{hasura.PORT}}/v1/metadata");
    expect(doc).toContain("Only `metrics-api` should receive a public Railway domain");
    expect(doc).toContain("Cloudflare");
    expect(doc).toContain("WAF");
  });

  test("uses pinned production Dockerfiles with real service commands", () => {
    const dockerignore = readFileSync(".dockerignore", "utf8");
    expect(dockerignore.split(/\r?\n/)).toContain(".pnpm-store");
    expect(dockerignore.split(/\r?\n/)).toContain("**/.envio");

    for (const dockerfile of ["Dockerfile-indexer", "Dockerfile-metrics-api", "Dockerfile-metrics-publisher"]) {
      const content = readFileSync(dockerfile, "utf8");
      expect(content).toContain("@sha256:");
      expect(content).toContain("apt-get install -y --no-install-recommends ca-certificates");
      expect(content).toContain("--only-upgrade libgcrypt20 libgnutls30");
      expect(content).not.toContain("apt-get upgrade");
      expect(content).toContain("COREPACK_HOME=/corepack");
      expect(content).toContain("pnpm --version");
      expect(content).toContain("pnpm install --frozen-lockfile");
      expect(content).toContain("/usr/local/lib/node_modules/npm");
      expect(content).not.toContain("node\", \"--version");
      expect(content).toContain("USER node");
    }

    expect(readFileSync("Dockerfile-hasura", "utf8")).toContain("--only-upgrade");
    expect(readFileSync("Dockerfile-hasura", "utf8")).not.toContain("apt-get upgrade");
    expect(readFileSync("Dockerfile-indexer", "utf8")).toContain("envio:start");
    expect(readFileSync("Dockerfile-indexer", "utf8")).toContain("chown -R node:node apps/indexer/.envio");
    const metricsApiDockerfile = readFileSync("Dockerfile-metrics-api", "utf8");
    const metricsPublisherDockerfile = readFileSync("Dockerfile-metrics-publisher", "utf8");
    expect(metricsApiDockerfile).toContain("pnpm --dir apps/indexer codegen");
    expect(metricsApiDockerfile).toContain("apps/indexer/.envio");
    expect(metricsApiDockerfile).toContain("apps/metrics-api");
    expect(metricsPublisherDockerfile).toContain("pnpm --dir apps/indexer codegen");
    expect(metricsPublisherDockerfile).toContain("apps/indexer/.envio");
    expect(metricsPublisherDockerfile).toContain("apps/metrics-publisher");
  });

  test("fails Hasura early when required Railway env variables are missing", () => {
    const content = readFileSync("Dockerfile-hasura", "utf8");

    expect(content).toContain("HASURA_GRAPHQL_DATABASE_URL:?");
    expect(content).toContain("HASURA_GRAPHQL_ADMIN_SECRET:?");
    expect(content).toContain("export HASURA_GRAPHQL_SERVER_PORT=\\\"$PORT\\\"");
    expect(content).toContain("HASURA_GRAPHQL_SERVER_PORT must match PORT when set");
    expect(content).toContain("USER hasura");
    expect(content).toContain("ENTRYPOINT []");
    expect(content).toContain("exec graphql-engine serve");
  });

  test("scans all Docker images with pinned Trivy CI checks", () => {
    const workflow = readFileSync(".github/workflows/security-scan.yml", "utf8");
    const packageJson = readFileSync("package.json", "utf8");

    expect(workflow).toContain("aquasecurity/trivy-action@57a97c7e7821a5776cebc9bb87c984fa69cba8f1");
    expect(workflow).toContain("docker/setup-buildx-action@4d04d5d9486b7bd6fa91e7baf45bbb4f8b9deedd");
    expect(workflow.match(/ignore-unfixed: true/g)?.length).toBe(4);

    for (const [name, dockerfile] of [
      ["indexer", "Dockerfile-indexer"],
      ["hasura", "Dockerfile-hasura"],
      ["metrics-api", "Dockerfile-metrics-api"],
      ["metrics-publisher", "Dockerfile-metrics-publisher"],
    ] as const) {
      expect(packageJson).toContain(`"docker:build:${name}"`);
      expect(packageJson).toContain(`"docker:tag:scan:${name}"`);
      expect(workflow).toContain(dockerfile);
      expect(workflow).toContain(`olympus-protocol-metrics/${name}:scan`);
    }
  });
});
