import { existsSync, readFileSync } from "node:fs";
import { createRailwayContext, type ResourceNode } from "railway/iac";
import { describe, expect, test, vi } from "vitest";
import images from "../../.railway/images.json";
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
      image: images.external["postgres-production"],
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
    expect(cache).toMatchObject({ networking: { serviceDomains: {}, customDomains: {} } });
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
          "/apps/metrics-publisher/**",
          "/packages/metrics-artifacts/**",
        ]),
      },
      deploy: { cronSchedule: "15 * * * *", restartPolicyType: "NEVER" },
      networking: { serviceDomains: {}, customDomains: {}, tcpProxies: {} },
    });
    const indexer = get("service.indexer");
    expect(indexer).toMatchObject({
      deploy: {
        restartPolicyType: "ON_FAILURE",
        restartPolicyMaxRetries: 10,
        limitOverride: { containers: { cpu: 2, memoryBytes: 2000000000 } },
      },
      networking: { serviceDomains: {}, customDomains: {}, tcpProxies: {} },
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

  test("keeps all services except the metrics API private", async () => {
    const { get } = await graph();
    for (const address of [
      "database.Postgres",
      "service.hasura",
      "service.indexer",
      "service.metrics-publisher",
      "service.rpc-cache",
      "service.rpc-cache-postgres",
    ] as const) {
      expect(get(address)).toMatchObject({
        networking: { serviceDomains: {}, customDomains: {}, tcpProxies: {} },
      });
    }
    expect(get("database.Postgres")).toMatchObject({
      networking: { privateNetworkEndpoint: "postgres" },
    });
    expect(get("service.metrics-api")).toMatchObject({
      networking: { customDomains: { "treasury-subgraph-api.olympusdao.finance": { port: 8080 } } },
    });
  });

  test("deploys production closures without coupling public artifact services to codegen", () => {
    for (const name of ["indexer", "metrics-api", "metrics-publisher"]) {
      const content = readFileSync(`Dockerfile-${name}`, "utf8");
      expect(content).toContain("@sha256:");
      expect(content).toContain("AS build");
      expect(content).toContain("AS runtime");
      expect(content).toContain("deploy --prod /deploy");
      expect(content).toContain("USER node");
      if (name !== "indexer") {
        expect(content).not.toContain("apps/indexer codegen");
        expect(content).not.toContain("COPY apps/indexer apps/indexer");
        expect(content).toContain(`dist/apps/${name}/src/cli.js`);
      }
    }
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

  test("CI reuses canonical source, image and integration validation", () => {
    const workflow = readFileSync(".github/workflows/security-scan.yml", "utf8");
    expect(workflow).toContain("pnpm run validate:images");
    expect(workflow).toContain("pnpm run test:integration");
    expect(readFileSync(".github/workflows/main.yml", "utf8")).toContain("pnpm run validate");
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
    for (const name of Object.keys(images.built))
      expect(scripts[`docker:build:${name}`]).toBeDefined();
    expect(Object.keys(images.external)).toContain("postgres-production");
  });
});
