import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const mode = process.argv[2];
if (!["source", "images", "integration", "all"].includes(mode) || process.argv.length !== 3) {
  console.error("Usage: node scripts/validate.mjs <source|images|integration|all>");
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
  images: [],
  scanPolicy:
    "Fail on fixable MEDIUM/HIGH/CRITICAL findings except the explicit approved CVE list.",
  exceptions: readFileSync(".trivyignore", "utf8")
    .split(/\r?\n/)
    .filter((line) => /^CVE-/.test(line)),
};
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

function runtimeAlignment() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const mise = readFileSync("mise.toml", "utf8");
  const pin = (tool) => {
    const value = mise.match(new RegExp(`^${tool}\\s*=\\s*"([^"]+)"`, "m"))?.[1];
    if (!value) throw new Error(`No ${tool} pin in mise.toml`);
    return value;
  };
  if (process.versions.node !== pin("node"))
    throw new Error("Node runtime does not match mise.toml");
  for (const file of [".nvmrc", ".node-version"]) {
    if (readFileSync(file, "utf8").trim() !== pin("node"))
      throw new Error(`${file} differs from mise.toml`);
  }
  if (
    pkg.packageManager !== `pnpm@${pin("pnpm")}` ||
    execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim() !== pin("pnpm")
  ) {
    throw new Error("pnpm runtime/manifest does not match mise.toml");
  }
  for (const name of ["indexer", "metrics-api", "metrics-publisher"]) {
    if (
      !readFileSync(`Dockerfile-${name}`, "utf8").includes(`FROM node:${pin("node")}-slim@sha256:`)
    )
      throw new Error(`Dockerfile-${name} has a different Node pin`);
    if (!readFileSync(`Dockerfile-${name}`, "utf8").includes(`pnpm@${pin("pnpm")}`))
      throw new Error(`Dockerfile-${name} has a different pnpm pin`);
  }
  console.log(`Runtime alignment passed: Node ${pin("node")}, pnpm ${pin("pnpm")}`);
}

async function source() {
  runtimeAlignment();
  await run("pnpm", ["install", "--frozen-lockfile"], { env: { CI: "true" } });
  for (const script of ["codegen", "check", "build", "test"]) await run("pnpm", ["run", script]);
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
async function scan(name, reference) {
  const identity = imageIdentity(name, reference);
  const output = join(directory, `image-${name}.json`);
  await run("mise", [
    "exec",
    "--locked",
    "trivy",
    "--",
    "trivy",
    "image",
    "--scanners",
    "vuln",
    "--severity",
    "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL",
    "--ignorefile",
    "/dev/null",
    "--format",
    "json",
    "--output",
    output,
    identity.id,
  ]);
  const results = JSON.parse(readFileSync(output, "utf8"));
  const findings = (results.Results ?? []).flatMap((result) => result.Vulnerabilities ?? []);
  identity.findings = Object.fromEntries(
    ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => [
      level,
      findings.filter((finding) => finding.Severity === level).length,
    ]),
  );
  identity.accepted = findings
    .filter((finding) => report.exceptions.includes(finding.VulnerabilityID))
    .map((finding) => ({ id: finding.VulnerabilityID, package: finding.PkgName }));
  identity.actionable = findings
    .filter(
      (finding) =>
        finding.FixedVersion &&
        ["MEDIUM", "HIGH", "CRITICAL"].includes(finding.Severity) &&
        !report.exceptions.includes(finding.VulnerabilityID),
    )
    .map((finding) => ({
      id: finding.VulnerabilityID,
      package: finding.PkgName,
      installed: finding.InstalledVersion,
      fixed: finding.FixedVersion,
    }));
  if (identity.actionable.length)
    throw new CommandFailure(
      1,
      `${name}: ${identity.actionable.length} fixable medium-or-higher findings; see ${output}`,
    );
  console.log(`${name}: policy passed; all-severity counts ${JSON.stringify(identity.findings)}`);
}
async function images() {
  await run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  await run("mise", ["install", "trivy", "--locked"]);
  let failure;
  for (const [name, reference] of Object.entries(inventory.built)) {
    try {
      await run("pnpm", ["run", `docker:build:${name}`]);
      await scan(name, reference);
    } catch (error) {
      failure ??= error;
      console.error(error.message);
    }
  }
  // Historical comparison inputs are not shipped; retain their identities for
  // the isolated existing-cluster compatibility test, not the release scan gate.
  for (const [name, reference] of Object.entries(inventory.comparison)) {
    try {
      await run("docker", ["pull", reference]);
      imageIdentity(name, reference);
    } catch (error) {
      failure ??= error;
      console.error(error.message);
    }
  }
  for (const [name, reference] of Object.entries(inventory.external)) {
    try {
      await run("docker", ["pull", reference]);
      await scan(name, reference);
    } catch (error) {
      failure ??= error;
      console.error(error.message);
    }
  }
  try {
    await run("mise", [
      "exec",
      "--locked",
      "trivy",
      "--",
      "trivy",
      "config",
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
async function integration() {
  await run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  for (const [name, reference] of Object.entries({
    ...inventory.built,
    "postgres-production": inventory.external["postgres-production"],
    "postgres-local": inventory.external["postgres-local"],
    ...inventory.comparison,
  }))
    imageIdentity(name, reference);
  let failure;
  try {
    await run("pnpm", ["run", "test:rpc-cache"]);
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

try {
  let failure;
  for (const [name, check] of Object.entries({ source, images, integration })) {
    if (mode !== name && mode !== "all") continue;
    try {
      await check();
    } catch (error) {
      failure ??= error;
      console.error(error.message);
    }
  }
  if (failure) throw failure;
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  process.exitCode = error instanceof CommandFailure ? error.code : 1;
  console.error(error.message);
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(directory, "report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(`Validation ${report.status}: ${resolve(directory, "report.json")}`);
}
