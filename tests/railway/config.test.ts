import { existsSync, readFileSync } from "node:fs";
import { createRailwayContext, type ResourceNode } from "railway/iac";
import { describe, expect, test, vi } from "vitest";
import { assertExpectedPlan, productionId } from "../../.railway/plan";
import defineInfrastructure from "../../.railway/railway";

async function graph() {
  const ctx = createRailwayContext({ environment: "production" });
  const definition = await defineInfrastructure(ctx, () => {
    throw new Error("Unexpected project helper");
  });
  expect(definition.name).toBe("treasury-subgraph");
  const resources = new Map(
    (definition.resources?.flat() ?? []).map((resource) => [resource.address, resource]),
  );
  return {
    addresses: [...resources.keys()].sort(),
    get(address: ResourceNode["address"]) {
      const resource = resources.get(address);
      if (resource === undefined) throw new Error(`Missing resource ${address}`);
      return resource;
    },
  };
}

describe("Railway config-as-code", () => {
  test("retains the eight imported resources and adds the private cache stack", async () => {
    const { addresses, get } = await graph();
    expect(addresses).toEqual([
      "bucket.bucket",
      "database.Postgres",
      "group.PostgreSQL",
      "service.hasura",
      "service.indexer",
      "service.metrics-api",
      "service.metrics-publisher",
      "service.rpc-cache",
      "service.rpc-cache-postgres",
      "volume.postgres-volume-ytRO",
      "volume.rpc-cache-postgres-volume",
    ]);
    expect(get("bucket.bucket")).toMatchObject({ config: { region: "sjc" } });
    expect(get("volume.postgres-volume-ytRO")).toMatchObject({
      config: {
        region: "us-west2",
        sizeMB: 50000,
        allowOnlineResize: true,
        alerts: { usage: { "80": {}, "95": {}, "100": {} } },
      },
    });
    const db = get("database.Postgres");
    expect(db).toMatchObject({
      groupId: "PostgreSQL",
      image: "ghcr.io/railwayapp-templates/postgres-ssl:18",
      deploy: { requiredMountPath: "/var/lib/postgresql/data" },
      networking: { privateNetworkEndpoint: "postgres" },
    });
    expect(db).not.toHaveProperty("volumeAttachments");
    expect(get("service.rpc-cache-postgres")).toMatchObject({
      volumeAttachments: {
        "rpc-cache-postgres-volume": {
          volume: "volume.rpc-cache-postgres-volume",
          mountPath: "/var/lib/postgresql/data",
        },
      },
      variables: { POSTGRES_PASSWORD: { type: "preserve" } },
    });
    const cache = get("service.rpc-cache");
    expect(cache).toMatchObject({ networking: { tcpProxies: {} } });
    expect(cache).not.toHaveProperty("networking.customDomains");
    expect(cache).toMatchObject({
      variables: {
        PORT: { type: "literal", value: "4000" },
        RPC_CACHE_DATABASE_URL: {
          type: "reference",
          resource: "service.rpc-cache-postgres",
          output: "DATABASE_URL",
        },
      },
    });
    expect(get("service.metrics-api")).toMatchObject({
      networking: { customDomains: { "treasury-subgraph-api.olympusdao.finance": { port: 8080 } } },
      variables: { ARTIFACT_ENDPOINT: { type: "preserve" } },
    });
  });

  test("evaluates service builds, restart behavior, existing domains and cutover routes", async () => {
    const { get } = await graph();
    for (const name of [
      "hasura",
      "indexer",
      "metrics-api",
      "metrics-publisher",
      "rpc-cache",
    ] as const) {
      const dockerfile = `Dockerfile-${name}`;
      expect(existsSync(dockerfile)).toBe(true);
      expect(existsSync(`railway-${name}.json`)).toBe(false);
      expect(get(`service.${name}`)).toMatchObject({
        build: {
          builder: "DOCKERFILE",
          dockerfilePath: dockerfile,
          watchPatterns: expect.arrayContaining([`/${dockerfile}`, "/.railway/**"]),
        },
        source: {
          repo: "OlympusDAO/olympus-protocol-metrics-subgraph",
          branch: "master",
          checkSuites: true,
        },
        deploy: { multiRegionConfig: { "us-west2": { numReplicas: 1 } } },
      });
    }
    const publisher = get("service.metrics-publisher");
    expect(publisher).toMatchObject({
      build: {
        watchPatterns: expect.arrayContaining([
          "/Dockerfile-indexer",
          "/apps/indexer/**",
          "/apps/metrics-publisher/**",
          "/packages/metrics-artifacts/**",
        ]),
      },
      deploy: { cronSchedule: "15 * * * *", restartPolicyType: "NEVER" },
      networking: { serviceDomains: { "metrics-publisher-production.up.railway.app": {} } },
    });
    const indexer = get("service.indexer");
    expect(indexer).toMatchObject({
      deploy: {
        restartPolicyType: "ON_FAILURE",
        restartPolicyMaxRetries: 10,
        limitOverride: { containers: { cpu: 2, memoryBytes: 2000000000 } },
      },
      networking: { serviceDomains: { "indexer-production-973a.up.railway.app": {} } },
      variables: { ENVIO_PG_PASSWORD: { type: "preserve" } },
    });
    expect(indexer).not.toHaveProperty("deploy.healthcheckPath");
    const routes = [
      ["ETHEREUM", 1],
      ["POLYGON", 137],
      ["FANTOM", 250],
      ["BASE", 8453],
      ["ARBITRUM", 42161],
      ["BERACHAIN", 80094],
      ["ROBINHOOD", 4663],
    ] as const;
    for (const [chain, id] of routes) {
      expect(indexer).toHaveProperty([`variables`, `ENVIO_${chain}_RPC_URL`], {
        type: "literal",
        value: `http://\${{rpc-cache.RAILWAY_PRIVATE_DOMAIN}}:4000/metrics/evm/${id}`,
      });
      expect(get("service.rpc-cache")).toHaveProperty(["variables", `UPSTREAM_RPC_URL_${id}`], {
        type: "preserve",
      });
    }
    vi.stubEnv("METRICS_RAILWAY_CACHE_BOOTSTRAP", "1");
    try {
      expect((await graph()).get("service.indexer")).toHaveProperty(
        "variables.ENVIO_ETHEREUM_RPC_URL",
        { type: "preserve" },
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("rejects unapproved changes in production plans", () => {
    const metadata = {
      kind: "railway.config.plan",
      version: 1,
      environmentId: productionId,
      destructive: false,
    };
    const create = {
      kind: "resource.create",
      address: "volume.rpc-cache-postgres-volume",
      path: "resources.volume.rpc-cache-postgres-volume",
    };
    const update = {
      kind: "resource.update",
      address: "service.indexer",
      field: "build",
      path: "resources.service.indexer.build",
      details: ["build.builder (RAILPACK → DOCKERFILE)"],
    };
    expect(() =>
      assertExpectedPlan({ ...metadata, changeSet: { changes: [create, update] } }, true),
    ).not.toThrow();
    for (const change of [
      { ...update, details: ["build.rootDirectory (/ → /tmp)"] },
      { ...update, severity: "destructive" },
      { ...create, kind: "resource.delete" },
      { ...create, kind: "resource.replace" },
      {
        kind: "resource.update",
        address: "volume.postgres-volume-ytRO",
        path: "resources.volume.postgres-volume-ytRO.config",
        details: ["config.sizeMB (50000 → 20000)"],
      },
    ]) {
      expect(() =>
        assertExpectedPlan({ ...metadata, changeSet: { changes: [change] } }, true),
      ).toThrow();
    }
    expect(() =>
      assertExpectedPlan({ ...metadata, changeSet: { changes: [create] } }, false),
    ).toThrow();
    expect(() =>
      assertExpectedPlan({ ...metadata, changeSet: { changes: [update] } }, false),
    ).toThrow();
    expect(() =>
      assertExpectedPlan(
        {
          ...metadata,
          changeSet: {
            changes: [
              {
                kind: "variable.set",
                address: "service.indexer",
                path: "resources.service.indexer.variables.ENVIO_ROBINHOOD_RPC_URL",
              },
            ],
          },
        },
        false,
      ),
    ).not.toThrow();
    expect(() =>
      assertExpectedPlan(
        { ...metadata, environmentId: "unexpected", changeSet: { changes: [] } },
        true,
      ),
    ).toThrow();
  });

  test("uses pinned production Dockerfiles with real service commands", () => {
    const dockerignore = readFileSync(".dockerignore", "utf8");
    const dockerignoreLines = dockerignore.split(/\r?\n/);
    expect(dockerignoreLines).toContain(".pnpm-store");
    expect(dockerignoreLines).toContain("**/.envio");
    expect(dockerignoreLines).toContain("apps/*/tests");
    expect(dockerignoreLines).toContain("packages/*/tests");
    expect(dockerignoreLines).toContain("tests");
    expect(dockerignoreLines).toContain("docs");
    expect(dockerignoreLines).toContain("tasks");
    expect(dockerignoreLines).toContain(".github");

    for (const dockerfile of [
      "Dockerfile-indexer",
      "Dockerfile-metrics-api",
      "Dockerfile-metrics-publisher",
    ]) {
      const content = readFileSync(dockerfile, "utf8");
      expect(content).toContain("@sha256:");
      expect(content).toContain("apt-get install -y --no-install-recommends ca-certificates");
      expect(content).toContain("--only-upgrade apt libapt-pkg6.0 libgcrypt20 libgnutls30");
      expect(content).not.toContain("apt-get upgrade");
      expect(content).toContain("COREPACK_HOME=/corepack");
      expect(content).toContain("pnpm --version");
      expect(content).toContain("RUN pnpm install --frozen-lockfile");
      expect(content.indexOf("RUN pnpm install --frozen-lockfile")).toBeLessThan(
        content.indexOf("COPY . ."),
      );
      expect(content).not.toContain("--mount=type=cache");
      expect(content).not.toContain("pnpm prune --prod");
      expect(content).toContain("/pnpm/store");
      expect(content).toContain("/root/.cache/pnpm");
      expect(content).toContain("/usr/local/lib/node_modules/corepack");
      expect(content).toContain("/usr/local/lib/node_modules/npm");
      expect(content).toContain("ENV PATH=/app/node_modules/.bin:");
      expect(content).not.toContain('node", "--version');
      expect(content).toContain("USER node");
    }

    expect(readFileSync("Dockerfile-hasura", "utf8")).toContain("--only-upgrade");
    expect(readFileSync("Dockerfile-hasura", "utf8")).not.toContain("apt-get upgrade");
    const indexerDockerfile = readFileSync("Dockerfile-indexer", "utf8");
    expect(indexerDockerfile).toContain("WORKDIR /app/apps/indexer");
    expect(indexerDockerfile).toContain('CMD ["tsx", "src/start-envio.ts", "start"]');
    expect(indexerDockerfile).toContain("chown -R node:node apps/indexer/.envio");
    const metricsApiDockerfile = readFileSync("Dockerfile-metrics-api", "utf8");
    const metricsPublisherDockerfile = readFileSync("Dockerfile-metrics-publisher", "utf8");
    expect(metricsApiDockerfile).toContain("pnpm --dir apps/indexer codegen");
    expect(metricsApiDockerfile).toContain("apps/indexer/.envio");
    expect(metricsApiDockerfile).toContain("WORKDIR /app/apps/metrics-api");
    expect(metricsApiDockerfile).toContain('CMD ["tsx", "src/cli.ts"]');
    expect(metricsPublisherDockerfile).toContain("pnpm --dir apps/indexer codegen");
    expect(metricsPublisherDockerfile).toContain("apps/indexer/.envio");
    expect(metricsPublisherDockerfile).toContain("WORKDIR /app/apps/metrics-publisher");
    expect(metricsPublisherDockerfile).toContain('CMD ["tsx", "src/cli.ts"]');
  });

  test("fails Hasura early when required Railway env variables are missing", () => {
    const content = readFileSync("Dockerfile-hasura", "utf8");

    expect(content).toContain("HASURA_GRAPHQL_DATABASE_URL:?");
    expect(content).toContain("HASURA_GRAPHQL_ADMIN_SECRET:?");
    expect(content).toContain('export HASURA_GRAPHQL_SERVER_PORT=\\"$PORT\\"');
    expect(content).toContain("HASURA_GRAPHQL_SERVER_PORT must match PORT when set");
    expect(content).toContain("USER hasura");
    expect(content).toContain("ENTRYPOINT []");
    expect(content).toContain("exec graphql-engine serve");
  });

  test("scans all Docker images with pinned Trivy CI checks", () => {
    const workflow = readFileSync(".github/workflows/security-scan.yml", "utf8");
    const packageJson = readFileSync("package.json", "utf8");

    expect(workflow).toContain(
      "aquasecurity/trivy-action@57a97c7e7821a5776cebc9bb87c984fa69cba8f1",
    );
    expect(workflow).toContain(
      "docker/setup-buildx-action@4d04d5d9486b7bd6fa91e7baf45bbb4f8b9deedd",
    );
    expect(workflow.match(/ignore-unfixed: true/g)?.length).toBe(5);
    expect(workflow).toContain("pnpm run test:rpc-cache");

    for (const [name, dockerfile] of [
      ["indexer", "Dockerfile-indexer"],
      ["hasura", "Dockerfile-hasura"],
      ["metrics-api", "Dockerfile-metrics-api"],
      ["metrics-publisher", "Dockerfile-metrics-publisher"],
      ["rpc-cache", "Dockerfile-rpc-cache"],
    ] as const) {
      expect(packageJson).toContain(`"docker:build:${name}"`);
      expect(packageJson).toContain(`"docker:tag:scan:${name}"`);
      expect(workflow).toContain(dockerfile);
      expect(workflow).toContain(`olympus-protocol-metrics/${name}:scan`);
    }
  });
});
