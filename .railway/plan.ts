import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const projectId = "1eff0b7c-1ab5-4f50-8c0d-29086746a17b";
export const productionId = "34764411-35d7-466c-8249-612730c36c07";
const applications = new Set([
  "service.indexer",
  "service.hasura",
  "service.metrics-api",
  "service.metrics-publisher",
]);
const newResources = new Set([
  "service.rpc-cache",
  "service.rpc-cache-postgres",
  "volume.rpc-cache-postgres-volume",
]);
const indexerRoute =
  /^resources\.service\.indexer\.variables\.ENVIO_(ETHEREUM|POLYGON|FANTOM|BASE|ARBITRUM|BERACHAIN|ROBINHOOD)_RPC_URL$/;
const cacheVariable = /^resources\.service\.rpc-cache\.variables\.(PORT|RPC_CACHE_DATABASE_URL)$/;

interface Change {
  kind: string;
  address: string;
  path: string;
  field?: string;
  details?: string[];
  severity?: string;
}

const appFields = {
  build: /^(build)\.(builder|buildEnvironment|dockerfilePath|watchPatterns)(?:[. (]|$)/,
  deploy:
    /^(deploy)\.(healthcheckPath|healthcheckTimeout|restartPolicyType|restartPolicyMaxRetries|cronSchedule)(?:[. (]|$)/,
};

function allowedAppChange(change: Change): boolean {
  const field = change.field;
  if (!applications.has(change.address) || (field !== "build" && field !== "deploy")) return false;
  if (change.path !== `resources.${change.address}.${field}`) return false;
  return (
    Array.isArray(change.details) &&
    change.details.length > 0 &&
    change.details.every((detail) => appFields[field].test(detail))
  );
}

export function assertExpectedPlan(
  plan: {
    kind?: string;
    version?: number;
    environmentId?: string;
    destructive?: boolean;
    changeSet?: { changes?: Change[] };
  },
  bootstrap: boolean,
): void {
  if (
    plan.kind !== "railway.config.plan" ||
    plan.version !== 1 ||
    plan.environmentId !== productionId ||
    plan.destructive !== false ||
    !Array.isArray(plan.changeSet?.changes)
  ) {
    throw new Error("Unexpected target, destructive plan, or unsupported saved plan format.");
  }
  for (const change of plan.changeSet.changes) {
    if (change?.severity === "destructive" || typeof change?.path !== "string") {
      throw new Error("Railway proposed a destructive or unrecognized change.");
    }
    const expected =
      (change.kind === "resource.create" &&
        bootstrap &&
        newResources.has(change.address) &&
        change.path === `resources.${change.address}`) ||
      (bootstrap && change.kind === "resource.update" && allowedAppChange(change)) ||
      (change.kind === "variable.set" &&
        (bootstrap ? cacheVariable.test(change.path) : indexerRoute.test(change.path)));
    if (!expected) throw new Error("Railway proposed drift outside the approved migration.");
  }
}

function main() {
  const args = process.argv.slice(2);
  const bootstrap = args[0] === "--bootstrap";
  if (args.length > Number(bootstrap)) throw new Error("Usage: pnpm railway:plan [--bootstrap]");
  const railway = (args: string[], env = process.env) =>
    execFileSync("railway", args, {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });
  const linked = JSON.parse(railway(["status", "--json"]));
  if (linked.id !== projectId || linked.name !== "treasury-subgraph") {
    throw new Error("Link the treasury-subgraph Railway project before planning.");
  }

  const directory = mkdtempSync(join(tmpdir(), "metrics-railway-plan-"));
  const output = join(directory, "railway-plan.json");
  railway(["config", "plan", "--environment", productionId, "--out", output], {
    ...process.env,
    RAILWAY_PROJECT_ID: projectId,
    RAILWAY_ENVIRONMENT_ID: productionId,
    METRICS_RAILWAY_CACHE_BOOTSTRAP: bootstrap ? "1" : "0",
  });
  assertExpectedPlan(JSON.parse(readFileSync(output, "utf8")), bootstrap);
  console.log(`Review the private saved production plan at ${output}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    // CLI failures may include remote payloads. Keep them out of shared logs.
    const message =
      error instanceof Error && !("status" in error) && !("code" in error)
        ? error.message
        : "Railway could not generate a plan. Verify CLI authentication, project linkage, and config ownership.";
    console.error(message);
    process.exitCode = 1;
  }
}
