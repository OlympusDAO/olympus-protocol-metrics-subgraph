import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

type PackFile = {
  path: string;
};

type PackSummary = {
  files: PackFile[];
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const repoRoot = resolve(packageDir, "../..");
const npmCacheDir = resolve(tmpdir(), "olympus-treasury-subgraph-npm-cache");

function capture(command: string, args: string[], cwd = packageDir): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function run(command: string, args: string[], cwd = packageDir): void {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
  });
}

function fail(message: string): never {
  throw new Error(`[client release] ${message}`);
}

function assertPackageMetadata(): void {
  const packageJson = JSON.parse(readFileSync(resolve(packageDir, "package.json"), "utf8")) as {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  if (packageJson.name !== "@olympusdao/treasury-subgraph-client") {
    fail(`Unexpected package name: ${packageJson.name ?? "(missing)"}`);
  }

  if (packageJson.version === undefined || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(packageJson.version)) {
    fail(`Package version must be a concrete semver version, got: ${packageJson.version ?? "(missing)"}`);
  }

  if (Object.keys(packageJson.dependencies ?? {}).length > 0) {
    fail("Client package should not publish runtime dependencies without an explicit release-process update.");
  }

  if (Object.keys(packageJson.peerDependencies ?? {}).length > 0) {
    fail("Client package should not publish peer dependencies without an explicit release-process update.");
  }
}

function assertNodeVersion(): void {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);
  if (!Number.isInteger(major) || major < 24) {
    fail(`Node.js 24+ is required for release checks, got ${process.versions.node}`);
  }
}

function assertCleanGitTree(): void {
  const status = capture("git", ["status", "--porcelain"], repoRoot).trim();
  if (status.length > 0) {
    fail("Cannot release from a dirty git tree. Commit or stash changes before publishing.");
  }
}

function assertPackAllowlist(): void {
  const packOutput = capture(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts", "--cache", npmCacheDir],
    packageDir,
  );
  const parsed = JSON.parse(packOutput) as PackSummary[];
  const files = parsed[0]?.files ?? [];
  const disallowed = files
    .map((file) => file.path)
    .filter(
      (path) => path !== "package.json" && path !== "CHANGELOG.md" && path !== "openapi.json" && !path.startsWith("dist/"),
    );

  if (files.length === 0) {
    fail("npm pack dry run did not report any files.");
  }

  if (disallowed.length > 0) {
    fail(`npm package includes files outside the allowlist: ${disallowed.join(", ")}`);
  }
}

assertPackageMetadata();
assertNodeVersion();
assertCleanGitTree();
run("pnpm", ["install", "--frozen-lockfile"], repoRoot);
run("pnpm", ["run", "build"], packageDir);
run("pnpm", ["run", "test"], packageDir);
run("pnpm", ["audit", "--audit-level", "moderate"], repoRoot);
assertPackAllowlist();

console.log("Client release checks passed.");
