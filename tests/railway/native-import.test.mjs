import { execFileSync, spawnSync } from "node:child_process";
import { expect, test } from "vitest";

test("native Node imports the Railway authoring file without invoking provider callbacks", () => {
  expect(() =>
    execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "await import('./.railway/railway.ts')"],
      { stdio: "pipe" },
    ),
  ).not.toThrow();
});

test("native apply alias refuses a missing environment before reading a plan or provider", () => {
  const result = spawnSync("pnpm", ["run", "railway:apply"], { encoding: "utf8" });
  expect(result.status).toBe(2);
  expect(result.stderr).toContain("a value is required for '--environment <name|id>'");
});
