import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createRailwayContext, type ResourceNode } from "railway/iac";
import { describe, expect, test, vi } from "vitest";
import images from "../../.railway/images.json";
import { currentExposure } from "../../.railway/networking";
import defineInfrastructure from "../../.railway/railway";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const { parse } = createRequire(new URL("../../apps/indexer/package.json", import.meta.url))(
  "yaml",
);

async function graph(environment = "production") {
  const ctx = createRailwayContext({ environment });
  const evaluated = await defineInfrastructure(ctx, () => {
    throw new Error("Unexpected project helper");
  });
  const definition: typeof evaluated = JSON.parse(JSON.stringify(evaluated));
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
  test("retains the imported resources and adds the private cache stack and monitor", async () => {
    const { addresses, get } = await graph();
    expect(addresses).toEqual([
      "bucket.bucket",
      "database.Postgres",
      "group.PostgreSQL",
      "service.hasura",
      "service.indexer",
      "service.indexer-monitor",
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
      image: images.provider["postgres-production"],
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
      "indexer-monitor",
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
          watchPatterns: expect.arrayContaining([`/${dockerfile}`]),
        },
        source: {
          repo: "OlympusDAO/olympus-protocol-metrics-subgraph",
          branch: "master",
          checkSuites: true,
        },
        deploy: { multiRegionConfig: { "us-west2": { numReplicas: 1 } } },
      });
      expect(get(`service.${name}`)).not.toHaveProperty(
        "build.watchPatterns",
        expect.arrayContaining(["/.railway/**"]),
      );
    }
    const publisher = get("service.metrics-publisher");
    expect(publisher).toMatchObject({
      build: {
        watchPatterns: expect.arrayContaining([
          "/apps/metrics-publisher/src/**",
          "/apps/metrics-publisher/tsconfig.build.json",
          "/packages/metrics-artifacts/src/**",
        ]),
      },
      deploy: { cronSchedule: "15 * * * *", restartPolicyType: "NEVER" },
    });
    const indexer = get("service.indexer");
    expect(indexer).toMatchObject({
      deploy: {
        restartPolicyType: "ON_FAILURE",
        restartPolicyMaxRetries: 10,
        limitOverride: { containers: { cpu: 2, memoryBytes: 2000000000 } },
      },
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

  test("schedules the private monitor with its own build and existing bucket inputs", async () => {
    const { get } = await graph("staging");
    const monitor = get("service.indexer-monitor");
    expect(monitor).toMatchObject({
      build: {
        dockerfilePath: "Dockerfile-indexer-monitor",
        watchPatterns: [
          "/Dockerfile-indexer-monitor",
          "/.dockerignore",
          "/package.json",
          "/pnpm-lock.yaml",
          "/pnpm-workspace.yaml",
          "/apps/indexer-monitor/package.json",
          "/apps/indexer-monitor/tsconfig.json",
          "/apps/indexer-monitor/src/**",
        ],
      },
      deploy: {
        cronSchedule: "*/15 * * * *",
        restartPolicyType: "NEVER",
        multiRegionConfig: { "us-west2": { numReplicas: 1 } },
        limitOverride: { containers: { cpu: 1, memoryBytes: 1000000000 } },
      },
    });
    expect(monitor).toHaveProperty("variables", {
      DISCORD_WEBHOOK_URL: { type: "sharedReference", name: "DISCORD_WEBHOOK_URL" },
      INDEXER_METRICS_URL: {
        type: "literal",
        value: `http://\${{indexer.RAILWAY_PRIVATE_DOMAIN}}:\${{indexer.PORT}}/metrics`,
      },
      MONITOR_NAME: { type: "literal", value: "Metrics (staging)" },
      MONITOR_COOLDOWN_MINUTES: { type: "preserve" },
      ...Object.fromEntries(
        ["BUCKET", "ENDPOINT", "REGION", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY"].map((output) => [
          output,
          { type: "reference", resource: "bucket.bucket", output },
        ]),
      ),
    });
    expect(monitor).not.toHaveProperty("deploy.startCommand");
    expect(monitor).not.toHaveProperty("deploy.healthcheckPath");
    expect(monitor).not.toHaveProperty("volumeAttachments");
  });

  test("serialized SDK output keeps every non-API service private with TCP removals", async () => {
    const { get } = await graph();
    const ports = {
      "database.Postgres": "5432",
      "service.rpc-cache-postgres": "5432",
      "service.rpc-cache": "4000",
      "service.indexer": "9898",
      "service.indexer-monitor": undefined,
      "service.hasura": "8080",
      "service.metrics-publisher": undefined,
    } as const;
    for (const [address, port] of Object.entries(ports)) {
      const resource = get(address as ResourceNode["address"]);
      expect(resource).toHaveProperty("networking.serviceDomains", {});
      expect(resource).toHaveProperty("networking.customDomains", {});
      expect(resource).toHaveProperty("networking.tcpProxies", port ? { [port]: null } : {});
    }
    expect(get("database.Postgres")).toHaveProperty(
      "networking.privateNetworkEndpoint",
      "postgres",
    );
    expect(get("service.metrics-api")).toHaveProperty("networking.tcpProxies", { 8080: null });
  });

  test("refuses unexpected HTTP exposure and incomplete or ambiguous provider snapshots", () => {
    const config = { services: { id: { networking: { tcpProxies: { 5432: {} } } } } };
    const node = {
      serviceId: "id",
      serviceName: "indexer",
      domains: { serviceDomains: [], customDomains: [] },
    };
    expect(currentExposure(config, [{ node }]).get("indexer")).toEqual([5432]);
    for (const value of [undefined, null]) {
      expect(
        currentExposure({ services: { id: { networking: value } } }, [{ node }]).get("indexer"),
      ).toEqual([]);
      expect(
        currentExposure({ services: { id: { networking: { tcpProxies: value } } } }, [
          { node },
        ]).get("indexer"),
      ).toEqual([]);
    }
    for (const value of [[], false, 0, "invalid"]) {
      expect(() =>
        currentExposure({ services: { id: { networking: value } } }, [{ node }]),
      ).toThrow("Incomplete Railway exposure lookup");
      expect(() =>
        currentExposure({ services: { id: { networking: { tcpProxies: value } } } }, [{ node }]),
      ).toThrow("Incomplete Railway exposure lookup");
    }
    expect(() => currentExposure({}, [{ node }])).toThrow();
    expect(currentExposure({}, []).size).toBe(0);
    expect(currentExposure("{}", []).size).toBe(0);
    for (const services of [null, []]) expect(() => currentExposure({ services }, [])).toThrow();
    expect(currentExposure({ services: { removed: null } }, []).size).toBe(0);
    expect(currentExposure({ services: { removed: { isDeleted: true } } }, []).size).toBe(0);
    for (const service of [{}, { isDeleted: false }, { isDeleted: "true" }, "unknown"]) {
      expect(() => currentExposure({ services: { unmatched: service } }, [])).toThrow(
        "Unaccounted",
      );
    }
    expect(() => currentExposure(config, [{ node }, { node }])).toThrow("Ambiguous");
    expect(() =>
      currentExposure(config, [{ node: { ...node, serviceName: "unknown-public-tcp" } }]),
    ).toThrow("Unrecognized");
    expect(() =>
      currentExposure(
        {
          services: {
            ...config.services,
            unaccounted: { networking: { tcpProxies: { 5432: {} } } },
          },
        },
        [{ node }],
      ),
    ).toThrow("Unaccounted");
    expect(() => currentExposure(config, [{ node: { ...node, domains: {} } }])).toThrow();
    expect(() =>
      currentExposure({ services: { id: { networking: { tcpProxies: { invalid: {} } } } } }, [
        { node },
      ]),
    ).toThrow("Invalid");
  });

  test("allows generated and custom domains on the API service, regardless of hostname", () => {
    expect(
      currentExposure({ services: { api: {} } }, [
        {
          node: {
            serviceId: "api",
            serviceName: "metrics-api",
            domains: {
              serviceDomains: [{ domain: "api-generated.example" }],
              customDomains: [{ domain: "api-alternate.example" }],
            },
          },
        },
      ]).get("metrics-api"),
    ).toEqual([]);
  });

  test("blocks either HTTP domain kind on every private service", () => {
    for (const serviceName of [
      "Postgres",
      "rpc-cache-postgres",
      "rpc-cache",
      "hasura",
      "indexer",
      "indexer-monitor",
      "metrics-publisher",
    ]) {
      for (const kind of ["serviceDomains", "customDomains"]) {
        expect(() =>
          currentExposure({ services: { private: {} } }, [
            {
              node: {
                serviceId: "private",
                serviceName,
                domains: {
                  serviceDomains: [],
                  customDomains: [],
                  [kind]: [{ domain: "unexpected.example" }],
                },
              },
            },
          ]),
        ).toThrow("Unexpected public HTTP exposure");
      }
    }
  });

  test("SDK callback rejects drift, preserves resources and emits imported TCP removals", async () => {
    const nodes = ["Postgres", "indexer", "indexer-monitor"].map((serviceName) => ({
      serviceId: serviceName,
      serviceName,
      domains: { serviceDomains: [] as { domain: string }[], customDomains: [] },
    }));
    const indexerNode = nodes.find((node) => node.serviceName === "indexer");
    if (!indexerNode) throw new Error("Missing indexer fixture");
    const response = {
      data: {
        environment: {
          config: {
            services: {
              Postgres: { networking: { tcpProxies: { 15432: {} } } },
              indexer: { networking: { tcpProxies: { 9000: {} } } },
              "indexer-monitor": { networking: { tcpProxies: { 9001: {} } } },
            },
          },
          serviceInstances: {
            edges: nodes.map((node) => ({ node })),
            pageInfo: { hasNextPage: false },
          },
          volumeInstances: {
            edges: [{ node: { sizeMB: 75000, volume: { name: "postgres-volume-ytRO" } } }],
            pageInfo: { hasNextPage: false },
          },
        },
      },
    };
    const execute = vi.mocked(execFileSync);
    const evaluate = () =>
      defineInfrastructure(
        createRailwayContext({
          command: "plan",
          environment: "production",
          environmentId: "fixture-env",
        }),
        () => {
          throw Error("Unexpected helper");
        },
      );
    try {
      indexerNode.domains.serviceDomains = [{ domain: "unexpected.example" }];
      execute.mockReturnValue(JSON.stringify(response));
      await expect(Promise.resolve().then(evaluate)).rejects.toThrow(
        "Cannot establish safe Railway",
      );
      await expect(Promise.resolve().then(evaluate)).rejects.toThrow(
        "Reason: Unexpected public HTTP exposure",
      );
      execute.mockReturnValueOnce("malformed fixture-sensitive-provider-response");
      const malformed = Promise.resolve().then(evaluate);
      await expect(malformed).rejects.toThrow("Cannot establish safe Railway");
      await expect(malformed).rejects.not.toThrow("fixture-sensitive-provider-response");
      indexerNode.domains.serviceDomains = [];
      execute.mockReturnValue(JSON.stringify(response));
      const definition = JSON.parse(JSON.stringify(await evaluate()));
      expect(
        definition.resources.find((r: ResourceNode) => r.address === "database.Postgres"),
      ).toMatchObject({
        type: "database",
        deploy: { requiredMountPath: "/var/lib/postgresql/data" },
        networking: { privateNetworkEndpoint: "postgres", tcpProxies: { 5432: null, 15432: null } },
      });
      expect(
        definition.resources.find((r: ResourceNode) => r.address === "service.indexer").networking
          .tcpProxies,
      ).toEqual({ 9898: null, 9000: null });
      expect(
        definition.resources.find((r: ResourceNode) => r.address === "service.indexer-monitor")
          .networking.tcpProxies,
      ).toEqual({ 9001: null });
      expect(
        definition.resources.find((r: ResourceNode) => r.address === "volume.postgres-volume-ytRO")
          .config.sizeMB,
      ).toBe(75000);
      expect(
        definition.resources.find((r: ResourceNode) => r.address === "service.rpc-cache-postgres")
          .variables.POSTGRES_PASSWORD,
      ).toEqual({
        type: "raw",
        value: { defaultValue: `\${{ secret(64, "0123456789abcdef") }}` },
      });
      const cacheDatabaseNode = {
        serviceId: "cache-db",
        serviceName: "rpc-cache-postgres",
        domains: { serviceDomains: [], customDomains: [] },
      };
      nodes.push(cacheDatabaseNode);
      Object.assign(response.data.environment.config.services, { "cache-db": {} });
      response.data.environment.serviceInstances.edges = nodes.map((node) => ({ node }));
      execute.mockReturnValue(JSON.stringify(response));
      const existing = JSON.parse(JSON.stringify(await evaluate()));
      expect(
        existing.resources.find((r: ResourceNode) => r.address === "service.rpc-cache-postgres")
          .variables.POSTGRES_PASSWORD,
      ).toEqual({ type: "preserve" });
      cacheDatabaseNode.serviceName = "";
      execute.mockReturnValue(JSON.stringify(response));
      await expect(Promise.resolve().then(evaluate)).rejects.toThrow(
        "Cannot establish safe Railway",
      );
      for (const [executable, args] of execute.mock.calls) {
        expect(executable).toBe("railway");
        expect(args?.[0]).toBe("api");
        expect(args?.[1]).toMatch(/^query\(/);
        expect(args?.[1]).toContain("config(decryptVariables: false)");
      }
    } finally {
      execute.mockReset();
    }
  });

  test("fixed image groups cover the whole evaluated project and known local fixtures", async () => {
    const { addresses, get } = await graph();
    expect(Object.keys(images).sort()).toEqual(["built", "comparison", "local", "provider"]);
    expect(Object.keys(images.local).sort()).toEqual([
      "minio-client-local",
      "minio-local",
      "postgres-local",
    ]);
    expect(Object.keys(images.comparison)).toEqual(["postgres-previous"]);
    expect(Object.keys(images.provider)).toEqual(["postgres-production"]);
    const built = [];
    const provider = [];
    for (const address of addresses) {
      const resource = get(address as ResourceNode["address"]);
      if (resource.type === "database") provider.push(resource.image);
      if (resource.type === "service") {
        if (resource.source?.image) provider.push(resource.source.image);
        else {
          expect(resource.build?.builder).toBe("DOCKERFILE");
          built.push(resource.name);
        }
      }
    }
    expect(built.sort()).toEqual(Object.keys(images.built).sort());
    expect(provider).toEqual([
      images.provider["postgres-production"],
      images.provider["postgres-production"],
    ]);
    expect(images.provider["postgres-production"]).toMatch(
      /^ghcr\.io\/railwayapp-templates\/postgres-ssl:/,
    );
  });

  test("deploys only the monitor production closure in the Alpine image", () => {
    const dockerfile = readFileSync("Dockerfile-indexer-monitor", "utf8");
    const [base, ...instructions] = dockerfile.trim().split(/\r?\n/);
    expect(base).toMatch(/^FROM node:\d+\.\d+\.\d+-alpine@sha256:[a-f0-9]{64} AS base$/);
    expect(instructions).toContain("WORKDIR /app");
    expect(instructions).toContain("FROM base AS build");
    expect(instructions).toContain("FROM base AS runtime");
    expect(instructions).toContain("RUN pnpm install --frozen-lockfile --filter indexer-monitor");
    expect(instructions).toContain("RUN pnpm --filter indexer-monitor build");
    expect(instructions).toContain("RUN pnpm --filter indexer-monitor deploy --prod /deploy");
    expect(dockerfile).toContain("RUN apk upgrade --no-cache libcrypto3 libssl3 zlib");
    expect(dockerfile).toContain("rm -rf /usr/local/lib/node_modules /opt/yarn*");
    expect(instructions.filter((line) => line.startsWith("COPY "))).toEqual([
      "COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./",
      "COPY apps/indexer-monitor/package.json apps/indexer-monitor/package.json",
      "COPY apps/indexer-monitor/tsconfig.json apps/indexer-monitor/tsconfig.json",
      "COPY apps/indexer-monitor/src apps/indexer-monitor/src",
      "COPY --from=build --chown=node:node /deploy /app",
    ]);
    expect(instructions.slice(-2)).toEqual([
      "USER node",
      'CMD ["node", "dist/monitor-indexer.js"]',
    ]);
    expect(existsSync("apps/indexer-monitor/src/monitor-indexer.ts")).toBe(true);
    expect(existsSync("apps/indexer-monitor/src/monitor-indexer.mjs")).toBe(false);
    expect(existsSync("apps/indexer/src/monitor-indexer.mjs")).toBe(false);
    expect(existsSync("apps/indexer-monitor/test/monitor-indexer.test.mjs")).toBe(true);
    expect(existsSync("tests/railway/indexer-monitor.test.mjs")).toBe(false);
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

  test("CI exposes source and image phases while retaining local aggregates", () => {
    const workflow = readFileSync(".github/workflows/security-scan.yml", "utf8");
    expect(workflow).toContain("trivy image --scanners vuln,secret");
    expect(workflow).not.toContain("--ignore-unfixed");
    expect(workflow).toContain("trivy config");
    expect(workflow).toContain('--file-patterns "dockerfile:Dockerfile-.*"');
    expect(workflow).toContain("fail-fast: false");
    expect(workflow).toContain("pnpm run test:integration");
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    for (const command of ["check:runtime-versions", "check", "typecheck", "build", "test"])
      expect(ci).toContain(`command: ${command}`);
    expect(ci).toContain("pnpm run build");
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
    expect(scripts.validate).toBe("node scripts/validate.mjs source");
    expect(scripts.typecheck).toBe("tsc --noEmit && pnpm --dir apps/indexer-monitor typecheck");
    expect(scripts.build).not.toContain("--noEmit");
    expect(scripts.build.split(" && ")).toContain("pnpm --dir apps/indexer-monitor build");
    expect(scripts.test.split(" && ")).toContain("pnpm --dir apps/indexer-monitor test");
    expect(scripts.lint).toBe("biome check --write . && pnpm run lint:actions");
    expect(scripts.check).toBe("biome check . && pnpm run lint:actions");
    for (const obsolete of ["format", "format:check", "lint:fix", "lint:check"])
      expect(scripts[obsolete]).toBeUndefined();
    expect(scripts["docker:scan:provider"]).toBe("node scripts/validate.mjs provider");
    expect(scripts["scan:images:provider"]).toBeUndefined();
    expect(scripts["docker:scan"]).not.toContain("--ignore-unfixed");
    expect(parse(readFileSync("trivy.yaml", "utf8")).vulnerability["ignore-unfixed"]).toBe(true);
    expect(scripts["docker:scan"]).not.toContain("--scanners");
    expect(scripts["railway:plan"]).toBe("railway config plan --out railway-plan.json");
    expect(scripts["railway:apply"]).toBe(
      "railway config apply --plan railway-plan.json --environment",
    );
    expect(readFileSync(".gitignore", "utf8").split(/\r?\n/)).toContain("railway-plan.json");
    expect(JSON.parse(readFileSync("package.json", "utf8")).engines).toMatchObject({
      node: ">=24.22.3 <25",
      pnpm: ">=11.28.13 <12",
    });
    for (const [name, image] of Object.entries(images.built)) {
      expect(scripts[`docker:build:${name}`]).toBe(
        `docker build -f Dockerfile-${name} -t ${image} .`,
      );
    }
    const monitorImage = images.built["indexer-monitor"];
    const imageJob = parse(workflow).jobs.images;
    expect(imageJob.strategy.matrix.include).toContainEqual(
      expect.objectContaining({ app: "indexer-monitor", image: monitorImage }),
    );
    const companions = imageJob.steps.find((step: { id?: string }) => step.id === "companions");
    expect(companions.run.split(/\r?\n/).map((line: string) => line.trim())).toContain(
      "pnpm run docker:build:indexer-monitor",
    );
  });
});
