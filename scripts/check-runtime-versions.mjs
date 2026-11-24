import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
) throw new Error("pnpm runtime/manifest does not match mise.toml");
for (const tool of ["railway", "trivy", "jactionlint", "zizmor"]) {
  const version = execFileSync("mise", ["exec", "--locked", tool, "--", tool, "--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).match(/\b\d+\.\d+\.\d+\b/)?.[0];
  if (version !== pin(tool)) throw new Error(`${tool} runtime does not match mise.toml`);
}
for (const name of ["indexer", "indexer-monitor", "metrics-api", "metrics-publisher"]) {
  const dockerfile = readFileSync(`Dockerfile-${name}`, "utf8");
  const variant = name === "indexer-monitor" ? "alpine" : "slim";
  if (!dockerfile.includes(`FROM node:${pin("node")}-${variant}@sha256:`))
    throw new Error(`Dockerfile-${name} has a different Node pin`);
  if (name !== "indexer-monitor" && !dockerfile.includes(`pnpm@${pin("pnpm")}`))
    throw new Error(`Dockerfile-${name} has a different pnpm pin`);
}
console.log(`Runtime alignment passed: ${["node", "pnpm", "railway", "trivy", "jactionlint", "zizmor"].map((tool) => `${tool} ${pin(tool)}`).join(", ")}`);
