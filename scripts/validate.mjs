import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const mode = process.argv[2];
if (
  !["source", "images", "integration", "all", "provider"].includes(mode) ||
  process.argv.length !== 3
) {
  console.error("Usage: node scripts/validate.mjs <source|images|integration|all|provider>");
  process.exit(2);
}
const directory = mkdtempSync(join(tmpdir(), "metrics-validation-"));
const inventory = JSON.parse(readFileSync(".railway/images.json", "utf8"));
const report = {
  mode,
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  startedAt: new Date().toISOString(),
  steps: [],
  groups: [],
  skips: [],
  images: [],
  imageFailures: [],
  providerImages: [],
  scanPolicy:
    "Default: repository-owned application images/Dockerfiles only; fixable MEDIUM/HIGH/CRITICAL vulnerabilities fail except existing approved CVEs, and MEDIUM/HIGH/CRITICAL secrets fail. Configured Railway PostgreSQL is advisory-provider/not-run by default; optional provider scans report vulnerabilities without vulnerability-based failure. Scanner/registry errors fail. Local/historical fixtures excluded.",
  ignorefile: ".trivyignore",
};
const trivyCache = process.env.TRIVY_CACHE_DIR;
const trivyArguments = [
  "exec",
  "--locked",
  "trivy",
  "--",
  "trivy",
  ...(trivyCache ? ["--cache-dir", trivyCache] : []),
];
let buildsReady = false;
report.scanCache = trivyCache ?? "Trivy native default cache";
console.log(`Validation evidence: ${directory}`);

class CommandFailure extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
async function run(command, args = [], options = {}) {
  const log = join(
    directory,
    `${String(report.steps.length + 1).padStart(2, "0")}-${command.replaceAll(/[^a-zA-Z0-9]/g, "_")}.log`,
  );
  const step = { command: [command, ...args], startedAt: new Date().toISOString(), log };
  report.steps.push(step);
  console.log(`\n> ${command} ${args.join(" ")}`);
  writeFileSync(log, "", { mode: 0o600 });
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...options.env },
  });
  for (const [stream, output] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    stream.on("data", (data) => {
      appendFileSync(log, data);
      output.write(data);
    });
  }
  const code = await new Promise((done) => {
    child.once("error", (error) => {
      appendFileSync(log, `${error.message}\n`);
      done(1);
    });
    child.once("close", (exitCode, signal) => {
      step.signal = signal;
      done(exitCode ?? 1);
    });
  });
  step.exitCode = code;
  step.finishedAt = new Date().toISOString();
  writeFileSync(join(directory, "report.json"), JSON.stringify(report, null, 2));
  if (code !== 0) throw new CommandFailure(code, `${command} failed (${code})`);
}

async function source() {
  await run("pnpm", ["install", "--frozen-lockfile"], { env: { CI: "true" } });
  for (const script of ["check:runtime-versions", "codegen", "check", "typecheck", "build", "test"])
    await run("pnpm", ["run", script]);
  await run("pnpm", ["audit", "--audit-level", "moderate"]);
}

function imageIdentity(name, reference) {
  const raw = JSON.parse(
    execFileSync("docker", ["image", "inspect", reference], { encoding: "utf8" }),
  )[0];
  const identity = {
    name,
    reference,
    id: raw.Id,
    repoDigests: raw.RepoDigests,
    size: raw.Size,
    os: raw.Os,
    architecture: raw.Architecture,
  };
  report.images.push(identity);
  return identity;
}
async function scan(name, reference, advisory = false) {
  const identity = imageIdentity(name, reference);
  await run("mise", [
    ...trivyArguments,
    "image",
    "--scanners",
    advisory ? "vuln" : "vuln,secret",
    ...(!advisory ? ["--image-config-scanners", "secret"] : []),
    "--input",
    "",
    "--format",
    "table",
    "--output",
    "",
    "--severity",
    advisory ? "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL" : "MEDIUM,HIGH,CRITICAL",
    `--ignore-unfixed=${!advisory}`,
    "--ignorefile",
    advisory ? "/dev/null" : ".trivyignore",
    "--exit-code",
    advisory ? "0" : "1",
    reference,
  ]);
  identity.scanStatus = advisory ? "advisory-provider/scanned" : "passed";
  identity.scanLog = report.steps.at(-1).log;
  report.scanner = JSON.parse(
    execFileSync("mise", [...trivyArguments, "version", "--format", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
}
const providerReason =
  "Upstream maintains image contents; the repository selects the pinned tag/digest. Findings are reviewed separately, not treated as owned-app failures.";
async function images() {
  report.providerImages = Object.entries(inventory.provider).map(([name, reference]) => ({
    name,
    reference,
    status: "advisory-provider/not-run",
    reason: providerReason,
  }));
  for (const entry of report.providerImages)
    console.log(`${entry.name}: ${entry.status}; ${entry.reason}`);
  for (const [kind, entries] of [
    ["local", inventory.local],
    ["historical", inventory.comparison],
  ]) {
    for (const [name, reference] of Object.entries(entries)) {
      const reason = `${kind === "local" ? "Local development/test" : "Historical compatibility"} fixture, not deployed by Railway IaC, excluded by explicit user policy.`;
      report.skips.push({ name, reference, status: "excluded", reason });
      console.log(`${name}: excluded; ${reason}`);
    }
  }
  await run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  dockerIdentity();
  await run("mise", ["install", "trivy", "--locked"]);
  let failure;
  for (const [name, reference] of Object.entries(inventory.built)) {
    try {
      await run("pnpm", ["run", `docker:build:${name}`]);
      await scan(name, reference);
    } catch (error) {
      report.imageFailures.push({ name, reference, status: "failed", error: error.message });
      failure ??= error;
      console.error(error.message);
    }
  }
  // Scan findings do not invalidate successful native builds.
  buildsReady = Object.keys(inventory.built).every((name) =>
    report.steps.some(
      ({ command, exitCode }) =>
        command[0] === "pnpm" && command[2] === `docker:build:${name}` && exitCode === 0,
    ),
  );
  try {
    await run("mise", [
      ...trivyArguments,
      "config",
      "--format",
      "table",
      "--output",
      "",
      "--file-patterns",
      "dockerfile:Dockerfile-*",
      "--skip-dirs",
      "node_modules",
      "--skip-dirs",
      ".pnpm-store",
      "--severity",
      "MEDIUM,HIGH,CRITICAL",
      "--exit-code",
      "1",
      ".",
    ]);
  } catch (error) {
    failure ??= error;
  }
  if (failure) throw failure;
}
async function provider() {
  await run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  dockerIdentity();
  await run("mise", ["install", "trivy", "--locked"]);
  let failure;
  for (const [name, reference] of Object.entries(inventory.provider)) {
    try {
      await run("docker", ["pull", reference]);
      await scan(name, reference, true);
      report.providerImages.push({
        name,
        reference,
        status: "advisory-provider/scanned",
        reason: providerReason,
      });
    } catch (error) {
      report.imageFailures.push({ name, reference, status: "failed", error: error.message });
      report.providerImages.push({ name, reference, status: "failed", reason: error.message });
      failure ??= error;
    }
  }
  if (failure) throw failure;
}
async function integration() {
  if (mode === "all" && !buildsReady)
    throw new Error(
      "Integration not run: required application image builds did not complete successfully",
    );
  await run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  dockerIdentity();
  // Security scans do not pull fixtures. Integration prepares only the exact
  // fixture images its required container tests consume; pull errors still fail.
  for (const reference of [
    ...Object.values(inventory.provider),
    inventory.local["postgres-local"],
    ...Object.values(inventory.comparison),
  ])
    await run("docker", ["pull", reference]);
  for (const [name, reference] of Object.entries({
    ...inventory.built,
    ...inventory.provider,
    "postgres-local": inventory.local["postgres-local"],
    ...inventory.comparison,
  }))
    imageIdentity(name, reference);
  let failure;
  try {
    await run("pnpm", ["run", "test:rpc-cache"], {
      env: { RPC_CACHE_IMAGE: inventory.built["rpc-cache"], CONTAINER_RUNTIME: "docker" },
    });
  } catch (error) {
    failure = error;
    console.error(error.message);
  }
  try {
    await run(process.execPath, ["--test", "tests/integration/runtime.test.mjs"]);
  } catch (error) {
    failure ??= error;
    console.error(error.message);
  }
  if (failure) throw failure;
}

function dockerIdentity() {
  const identity = {
    context: execFileSync("docker", ["context", "show"], { encoding: "utf8" }).trim(),
    daemon: JSON.parse(
      execFileSync("docker", ["info", "--format", "{{json .ID}}"], { encoding: "utf8" }),
    ),
    hostOverride: process.env.DOCKER_HOST ?? null,
  };
  report.docker ??= identity;
  report.finalDocker = identity;
  if (JSON.stringify(report.docker) !== JSON.stringify(identity))
    throw new Error("Effective Docker context/daemon changed during validation");
}

try {
  let failure;
  for (const [name, check] of Object.entries({ source, images, integration, provider })) {
    if (mode !== name && !(mode === "all" && name !== "provider")) continue;
    const group = { name, status: "running" };
    report.groups.push(group);
    try {
      await check();
      group.status = name === "provider" ? "completed-advisory" : "passed";
    } catch (error) {
      group.status = "failed";
      group.error = error.message;
      failure ??= error;
      console.error(error.message);
    }
  }
  if (failure) throw failure;
  report.status = mode === "provider" ? "completed-advisory" : "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  process.exitCode = error instanceof CommandFailure ? error.code : 1;
  console.error(error.message);
} finally {
  if (report.docker) {
    try {
      dockerIdentity();
    } catch (error) {
      report.status = "failed";
      report.error = error.message;
      process.exitCode ||= 1;
    }
  }
  report.finalRevision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  report.finalDirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(directory, "report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(`Validation ${report.status}: ${resolve(directory, "report.json")}`);
}
