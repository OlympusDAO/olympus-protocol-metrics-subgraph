import { execFileSync } from "node:child_process";
import type { RailwayContext } from "railway/iac";
import {
  bucket,
  database,
  defineRailway,
  github,
  group,
  image,
  preserve,
  project,
  ref,
  service,
  volume,
} from "railway/iac";
import images from "./images.json" with { type: "json" };
import { currentExposure, ExposureError, enforceExposure } from "./networking.ts";

const postgresPasswordGenerator = `\${{ secret(64, "0123456789abcdef") }}`;

function existingResources(ctx: RailwayContext):
  | {
      volumeSizes: ReadonlyMap<string, number>;
      tcpPorts: ReadonlyMap<string, number[]>;
    }
  | undefined {
  if (!ctx.environmentId) return undefined;
  try {
    const result = JSON.parse(
      execFileSync(
        "railway",
        [
          "api",
          "query($id: String!) { environment(id: $id) { config(decryptVariables: false) serviceInstances(first: 100) { edges { node { serviceId serviceName domains { serviceDomains { domain } customDomains { domain } } } } pageInfo { hasNextPage } } volumeInstances(first: 100) { edges { node { sizeMB volume { name } } } pageInfo { hasNextPage } } } }",
          "--var",
          `id=${ctx.environmentId}`,
          "--compact",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 },
      ),
    );
    const services = result.data?.environment?.serviceInstances;
    const volumes = result.data?.environment?.volumeInstances;
    if (
      result.errors?.length ||
      !Array.isArray(services?.edges) ||
      services.pageInfo?.hasNextPage !== false ||
      !Array.isArray(volumes?.edges) ||
      volumes.pageInfo?.hasNextPage !== false ||
      volumes.edges.some(
        (edge: { node?: { sizeMB?: unknown; volume?: { name?: unknown } } }) =>
          typeof edge.node?.volume?.name !== "string" ||
          !edge.node.volume.name.trim() ||
          typeof edge.node.sizeMB !== "number" ||
          !Number.isSafeInteger(edge.node.sizeMB) ||
          edge.node.sizeMB <= 0,
      )
    )
      throw new ExposureError("Incomplete resource lookup");
    const volumeSizes = new Map<string, number>(
      volumes.edges.map((edge: { node: { sizeMB: number; volume: { name: string } } }) => [
        edge.node.volume.name,
        edge.node.sizeMB,
      ]),
    );
    if (volumeSizes.size !== volumes.edges.length)
      throw new ExposureError("Ambiguous volume lookup");
    return {
      tcpPorts: currentExposure(result.data.environment.config, services.edges),
      volumeSizes,
    };
  } catch (error) {
    const reason = error instanceof ExposureError ? ` Reason: ${error.message}` : "";
    throw new Error(
      `Cannot establish safe Railway services, exposure and volumes; refusing to plan. Check pagination, current TCP ports and the HTTP domain allowlist; unexpected domains need separately authorized provider removal.${reason}`,
    );
  }
}

const region = "us-west2";
const mountPath = "/var/lib/postgresql/data";
const artifactKeys = [
  "ARTIFACT_ACCESS_KEY_ID",
  "ARTIFACT_BUCKET",
  "ARTIFACT_ENDPOINT",
  "ARTIFACT_REGION",
  "ARTIFACT_SECRET_ACCESS_KEY",
];
const hasuraKeys = ["HASURA_GRAPHQL_ADMIN_SECRET", "HASURA_GRAPHQL_ENDPOINT"];
const sharedWatch = [
  "/.dockerignore",
  "/package.json",
  "/pnpm-lock.yaml",
  "/pnpm-workspace.yaml",
  "/tsconfig.json",
  "/apps/client/package.json",
  "/apps/indexer/package.json",
  "/apps/metrics-api/package.json",
  "/apps/metrics-publisher/package.json",
];
const rpcVariables = {
  1: "ENVIO_ETHEREUM_RPC_URL",
  137: "ENVIO_POLYGON_RPC_URL",
  250: "ENVIO_FANTOM_RPC_URL",
  8453: "ENVIO_BASE_RPC_URL",
  42161: "ENVIO_ARBITRUM_RPC_URL",
  80094: "ENVIO_BERACHAIN_RPC_URL",
  4663: "ENVIO_ROBINHOOD_RPC_URL",
};
const preserved = (keys: string[]) => Object.fromEntries(keys.map((key) => [key, preserve()]));
const volumeSettings = {
  region,
  allowOnlineResize: true,
  alerts: { usage: { "80": {}, "95": {}, "100": {} } },
};
const failure = (healthcheckPath: string) => ({
  healthcheckPath,
  healthcheckTimeout: 30,
  restartPolicyType: "ON_FAILURE" as const,
  restartPolicyMaxRetries: 1,
});

export default defineRailway((ctx) => {
  const live = existingResources(ctx);
  const size = (name: string, minimum: number) =>
    Math.max(minimum, live?.volumeSizes.get(name) ?? 0);
  const source = github("OlympusDAO/olympus-protocol-metrics-subgraph", {
    branch: "master",
    checkSuites: true,
  });
  const build = (name: string, paths: string[]) => ({
    builder: "DOCKERFILE" as const,
    buildEnvironment: "V3" as const,
    dockerfilePath: `Dockerfile-${name}`,
    watchPatterns: [`/Dockerfile-${name}`, ...paths],
  });
  const deployment = { source, replicas: { [region]: 1 } };
  const runtime = { runtime: "V2", useLegacyStacker: false, ipv6EgressEnabled: false };
  const limits = (cpu = 1, memoryBytes = 1000000000) => ({
    ...runtime,
    limitOverride: { containers: { cpu, memoryBytes } },
  });
  const importedVolume = volume("postgres-volume-ytRO", {
    ...volumeSettings,
    sizeMB: size("postgres-volume-ytRO", 50000),
  });
  const cacheVolume = volume("rpc-cache-postgres-volume", {
    ...volumeSettings,
    sizeMB: size("rpc-cache-postgres-volume", 20000),
  });
  const postgres = database("Postgres", "postgres", {
    image: images.provider["postgres-production"],
    region,
    defaultMountPath: mountPath,
  });
  postgres.deploy = { ...postgres.deploy, ...runtime, requiredMountPath: mountPath };
  postgres.networking = { privateNetworkEndpoint: "postgres" };
  // Railway CLI represents an existing managed database mount separately
  // from ordinary service attachments. Keep its mount through the live binding.

  // Keep the independently provisioned cache database and its volume binding.
  const cacheDatabase = service("rpc-cache-postgres", {
    source: image(images.provider["postgres-production"]),
    replicas: { [region]: 1 },
    deploy: { ...limits(), requiredMountPath: mountPath },
    volumeMounts: { [mountPath]: cacheVolume },
    env: {
      PGDATA: `${mountPath}/pgdata`,
      POSTGRES_DB: "railway",
      POSTGRES_USER: "postgres",
      // Preserve credentials unless complete inventory proves this database is new.
      POSTGRES_PASSWORD:
        !live || live.tcpPorts.has("rpc-cache-postgres")
          ? preserve()
          : { type: "raw", value: { defaultValue: postgresPasswordGenerator } },
      DATABASE_URL: `postgresql://postgres:\${{POSTGRES_PASSWORD}}@\${{RAILWAY_PRIVATE_DOMAIN}}:5432/railway`,
    },
  });
  const cache = service("rpc-cache", {
    ...deployment,
    build: build("rpc-cache", [
      "/.dockerignore",
      "/services/rpc-cache/erpc.js",
      "/services/rpc-cache/private-errors.patch",
      "/services/rpc-cache/pgx-v5.patch",
      "/services/rpc-cache/reject-null-cache.patch",
    ]),
    deploy: { ...limits(), ...failure("/healthcheck") },
    env: {
      PORT: "4000",
      RPC_CACHE_DATABASE_URL: ref(cacheDatabase, "DATABASE_URL"),
      ...preserved(Object.keys(rpcVariables).map((id) => `UPSTREAM_RPC_URL_${id}`)),
    },
  });

  // The first plan provisions the cache while indexer traffic still uses its current endpoints.
  const bootstrap = process.env.METRICS_RAILWAY_CACHE_BOOTSTRAP === "1";
  const routes = Object.fromEntries(
    Object.entries(rpcVariables).map(([id, key]) => [
      key,
      bootstrap
        ? preserve()
        : `http://\${{rpc-cache.RAILWAY_PRIVATE_DOMAIN}}:4000/metrics/evm/${id}`,
    ]),
  );
  const indexer = service("indexer", {
    ...deployment,
    build: build("indexer", [
      "/apps/indexer/src/**",
      "/apps/indexer/config.yaml",
      "/apps/indexer/schema.graphql",
      "/apps/indexer/tsconfig.json",
      "/apps/indexer/envio-env.d.ts",
      "/apps/indexer/.env.sample",
      ...sharedWatch,
    ]),
    deploy: {
      ...limits(2, 2000000000),
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    env: {
      ...preserved([
        "ENVIO_API_TOKEN",
        "ENVIO_PG_DATABASE",
        "ENVIO_PG_HOST",
        "ENVIO_PG_PASSWORD",
        "ENVIO_PG_PORT",
        "ENVIO_PG_SSL_MODE",
        "ENVIO_PG_USER",
        ...hasuraKeys,
        "PORT",
      ]),
      ...routes,
    },
  });
  const artifactBucket = bucket("bucket", { region: "sjc" });
  const indexerMonitor = service("indexer-monitor", {
    ...deployment,
    build: build("indexer-monitor", [
      "/.dockerignore",
      "/package.json",
      "/pnpm-lock.yaml",
      "/pnpm-workspace.yaml",
      "/apps/indexer-monitor/package.json",
      "/apps/indexer-monitor/src/**",
    ]),
    deploy: {
      ...limits(),
      cronSchedule: "*/15 * * * *",
      restartPolicyType: "NEVER",
    },
    env: {
      INDEXER_METRICS_URL: `http://\${{indexer.RAILWAY_PRIVATE_DOMAIN}}:\${{indexer.PORT}}/metrics`,
      DISCORD_WEBHOOK_URL: ctx.shared.DISCORD_WEBHOOK_URL,
      MONITOR_NAME: `Metrics (${ctx.environment ?? "default"})`,
      BUCKET: ref(artifactBucket, "BUCKET"),
      ENDPOINT: ref(artifactBucket, "ENDPOINT"),
      REGION: ref(artifactBucket, "REGION"),
      ACCESS_KEY_ID: ref(artifactBucket, "ACCESS_KEY_ID"),
      SECRET_ACCESS_KEY: ref(artifactBucket, "SECRET_ACCESS_KEY"),
    },
  });
  const hasura = service("hasura", {
    ...deployment,
    build: build("hasura", []),
    deploy: { ...limits(), ...failure("/healthz") },
    env: preserved(["HASURA_GRAPHQL_ADMIN_SECRET", "HASURA_GRAPHQL_DATABASE_URL", "PORT"]),
  });
  const metricsPublisher = service("metrics-publisher", {
    ...deployment,
    build: build("metrics-publisher", [
      "/apps/metrics-publisher/src/**",
      "/apps/metrics-publisher/tsconfig.build.json",
      "/packages/metrics-artifacts/src/**",
      ...sharedWatch,
    ]),
    deploy: { ...limits(), cronSchedule: "15 * * * *", restartPolicyType: "NEVER" },
    env: preserved([...artifactKeys, ...hasuraKeys]),
  });
  const metricsApi = service("metrics-api", {
    ...deployment,
    build: build("metrics-api", [
      "/apps/metrics-api/src/**",
      "/apps/metrics-api/tsconfig.build.json",
      "/packages/metrics-artifacts/src/**",
      ...sharedWatch,
    ]),
    deploy: { ...limits(), ...failure("/ready") },
    domains: [{ domain: "treasury-subgraph-api.olympusdao.finance", port: 8080 }],
    env: preserved(artifactKeys),
  });

  const definition = {
    variables: {
      managed: true,
      ignore: [
        "ENVIO_*_FALLBACK_RPC_URLS",
        "ENVIO_PG_MAX_CONNECTIONS",
        "INDEXER_DEPLOYMENT_ID",
        "METRICS_*",
        "RPC_CACHE_MAX_RPS",
      ],
    },
    resources: [
      group("PostgreSQL", [postgres]),
      importedVolume,
      artifactBucket,
      indexer,
      indexerMonitor,
      hasura,
      metricsPublisher,
      metricsApi,
      cache,
      cacheDatabase,
      cacheVolume,
    ],
  };
  return enforceExposure(project("treasury-subgraph", definition), live?.tcpPorts);
});
