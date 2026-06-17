import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

type PackageJson = {
  name?: string;
  version?: string;
};

type PackSummary = {
  filename?: string;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const repoRoot = resolve(packageDir, "../..");
const changelogPath = resolve(packageDir, "CHANGELOG.md");
const packageJsonPath = resolve(packageDir, "package.json");
const packageName = "@olympusdao/treasury-subgraph-client";
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const CHANGELOG_RELEASE_HEADING_PATTERN = new RegExp(
  `^## \\[v?(?:${SEMVER_PATTERN.source.slice(1, -1)})\\](?:\\s+-\\s+.+)?\\s*$`,
);

function fail(message: string): never {
  throw new Error(`[client release] ${message}`);
}

function capture(command: string, args: string[], cwd = repoRoot): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function run(command: string, args: string[], cwd = repoRoot): void {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
  });
}

function getExitStatus(error: unknown): number | undefined {
  return typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : undefined;
}

function getErrorProperty(error: unknown, key: string): unknown {
  if (typeof error !== "object" || error === null || !(key in error)) {
    return undefined;
  }
  return (error as Record<string, unknown>)[key];
}

function errorText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("utf8");
  }
  return "";
}

function isNpmRegistryNotFoundError(error: unknown): boolean {
  const code = errorText(getErrorProperty(error, "code"));
  const stderr = errorText(getErrorProperty(error, "stderr"));
  const message =
    error instanceof Error ? error.message : errorText(getErrorProperty(error, "message"));
  return (
    code === "E404" || stderr.includes("E404") || stderr.includes("404") || message.includes("E404")
  );
}

function readPackage(): Required<PackageJson> {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
  if (parsed.name !== packageName) {
    fail(`Unexpected package name: ${parsed.name ?? "(missing)"}`);
  }
  if (parsed.version === undefined || parsed.version.trim() === "") {
    fail("Package version is missing.");
  }
  if (!SEMVER_PATTERN.test(parsed.version)) {
    fail(`Package version must be valid semver: ${parsed.version}`);
  }
  return { name: parsed.name, version: parsed.version };
}

function tagForVersion(version: string): string {
  return `treasury-subgraph-client-v${version}`;
}

function isChangelogReleaseHeading(line: string): boolean {
  return CHANGELOG_RELEASE_HEADING_PATTERN.test(line);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readChangelogSection(version: string): string {
  const changelog = readFileSync(changelogPath, "utf8");
  const lines = changelog.split(/\r?\n/);
  const releaseHeading = new RegExp(`^## \\[v?${escapeRegExp(version)}\\](?:\\s+-\\s+.+)?\\s*$`);
  const start = lines.findIndex((line) => releaseHeading.test(line));
  if (start === -1) {
    fail(
      `Missing changelog section for ${packageName}@${version}. Expected heading like "## [v${version}]".`,
    );
  }

  const end = lines.findIndex((line, index) => index > start && isChangelogReleaseHeading(line));
  return lines
    .slice(start, end === -1 ? undefined : end)
    .join("\n")
    .trim();
}

function setGithubOutput(values: Record<string, string>): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath === undefined || outputPath.trim() === "") {
    for (const [key, value] of Object.entries(values)) {
      console.log(`${key}=${value}`);
    }
    return;
  }

  const output = `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
  writeFileSync(outputPath, output, {
    flag: "a",
  });
}

function assertExpectedVersion(): void {
  const expected = process.env.EXPECTED_VERSION?.trim();
  if (expected === undefined || expected === "") {
    fail("EXPECTED_VERSION is required.");
  }

  const { version } = readPackage();
  if (expected !== version) {
    fail(`Expected version ${expected}, but ${packageJsonPath} contains ${version}`);
  }

  setGithubOutput({ version, tag: tagForVersion(version) });
}

function assertVersionNotPublished(): void {
  const { version } = readPackage();
  let output = "";
  try {
    output = capture("npm", ["view", packageName, "versions", "--json"]).trim();
  } catch (error) {
    if (!isNpmRegistryNotFoundError(error)) {
      throw error;
    }
    output = "[]";
  }
  const versions = JSON.parse(output) as string[] | string;
  const publishedVersions = Array.isArray(versions) ? versions : [versions];
  if (publishedVersions.includes(version)) {
    fail(`${packageName}@${version} is already published on npm.`);
  }
}

function valueContainsVersion(value: unknown, version: string): boolean {
  if (typeof value === "string") {
    return (
      value === version ||
      value === `${packageName}@${version}` ||
      value.includes(`${packageName}@${version}`)
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) => valueContainsVersion(item, version));
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).some((item) => valueContainsVersion(item, version));
  }
  return false;
}

function assertVersionNotStaged(): void {
  const { version } = readPackage();
  const output = capture("npm", ["stage", "list", packageName, "--json"]).trim();
  if (output.length === 0) return;

  const staged = JSON.parse(output) as unknown;
  if (valueContainsVersion(staged, version)) {
    fail(`${packageName}@${version} is already staged on npm.`);
  }
}

function assertReleaseTagDoesNotExist(): void {
  const { version } = readPackage();
  const tag = tagForVersion(version);
  try {
    capture("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`]);
    fail(`Tag ${tag} already exists on origin.`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("[client release]")) {
      throw error;
    }
    if (getExitStatus(error) !== 2) {
      throw error;
    }
  }
}

function createGitTag(): void {
  const { version } = readPackage();
  const tag = tagForVersion(version);
  run("git", ["config", "user.name", "github-actions[bot]"]);
  run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  run("git", ["tag", "-a", tag, "-m", `Release ${packageName}@${version}`]);
  run("git", ["push", "origin", `refs/tags/${tag}`]);
}

function createGithubRelease(): void {
  const tarball = process.env.TARBALL_PATH?.trim();
  const packJson = process.env.PACK_JSON_PATH?.trim();
  const notes = process.env.RELEASE_NOTES_PATH?.trim();
  if (tarball === undefined || tarball === "") {
    fail("TARBALL_PATH is required.");
  }
  if (packJson === undefined || packJson === "") {
    fail("PACK_JSON_PATH is required.");
  }
  if (notes === undefined || notes === "") {
    fail("RELEASE_NOTES_PATH is required.");
  }
  if (!existsSync(tarball)) {
    fail(`Missing packed tarball: ${tarball}`);
  }
  if (!existsSync(packJson)) {
    fail(`Missing npm pack metadata: ${packJson}`);
  }
  if (!existsSync(notes)) {
    fail(`Missing GitHub release notes: ${notes}`);
  }

  const { version } = readPackage();
  const tag = tagForVersion(version);
  run("gh", [
    "release",
    "create",
    tag,
    tarball,
    packJson,
    "--title",
    `${packageName}@${version}`,
    "--notes-file",
    notes,
    "--verify-tag",
  ]);
}

function preflight(): void {
  assertExpectedVersion();
  assertVersionNotPublished();
  assertVersionNotStaged();
  assertReleaseTagDoesNotExist();
}

function validateReleaseInputs(): void {
  assertExpectedVersion();
  assertVersionNotPublished();
  assertReleaseTagDoesNotExist();
}

function pack(): void {
  const destination = process.env.PACK_DESTINATION?.trim();
  const cache = process.env.NPM_CACHE_DIR?.trim();
  if (destination === undefined || destination === "") {
    fail("PACK_DESTINATION is required.");
  }
  if (cache === undefined || cache === "") {
    fail("NPM_CACHE_DIR is required.");
  }
  mkdirSync(destination, { recursive: true });

  const packJsonPath = resolve(destination, "client-pack.json");
  const output = capture(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", destination, "--cache", cache],
    packageDir,
  );
  writeFileSync(packJsonPath, output);

  const parsed = JSON.parse(output) as PackSummary[];
  const filename = parsed[0]?.filename;
  if (filename === undefined || filename.trim() === "") {
    fail("npm pack did not return a tarball filename.");
  }

  const tarball = resolve(destination, filename);
  if (!existsSync(tarball)) {
    fail(`npm pack did not create expected tarball: ${tarball}`);
  }

  setGithubOutput({ filename, tarball, pack_json: packJsonPath });
}

function writeReleaseNotes(): void {
  const outputPath = process.env.RELEASE_NOTES_PATH?.trim();
  if (outputPath === undefined || outputPath === "") {
    fail("RELEASE_NOTES_PATH is required.");
  }

  const { version } = readPackage();
  const changelogSection = readChangelogSection(version);
  writeFileSync(
    outputPath,
    [
      `Package: \`${packageName}@${version}\``,
      "",
      "https://www.npmjs.com/package/@olympusdao/treasury-subgraph-client",
      "",
      "This GitHub release records the source commit and packed artifact produced by CI.",
      "",
      "## Changelog",
      "",
      changelogSection,
      "",
    ].join("\n"),
  );
}

const command = process.argv[2];
switch (command) {
  case "resolve":
    assertExpectedVersion();
    break;
  case "preflight":
    preflight();
    break;
  case "validate":
    validateReleaseInputs();
    break;
  case "pack":
    pack();
    break;
  case "notes":
    writeReleaseNotes();
    break;
  case "tag":
    createGitTag();
    break;
  case "github-release":
    createGithubRelease();
    break;
  default:
    fail(`Unknown ci-release command: ${command ?? "(missing)"}`);
}
