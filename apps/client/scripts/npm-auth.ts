import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

export const packageDir = resolve(scriptDir, "..");
export const registry = "https://registry.npmjs.org";
export const scope = "@olympusdao";
export const userConfig = resolve(packageDir, ".npmrc.local");
export const npmCacheDir = resolve(tmpdir(), "olympus-treasury-subgraph-npm-cache");

export function runNpm(args: string[]): void {
  execFileSync("npm", args, {
    cwd: packageDir,
    stdio: "inherit",
  });
}

export function removeLocalNpmConfig(): void {
  if (existsSync(userConfig)) {
    unlinkSync(userConfig);
  }
}

export function logoutAndRemoveLocalNpmConfig(): void {
  try {
    runNpm(["logout", "--registry", registry, "--scope", scope, "--userconfig", userConfig]);
  } catch {
    console.error("[client release] npm logout failed; removing local npm config anyway.");
  }
  removeLocalNpmConfig();
}
