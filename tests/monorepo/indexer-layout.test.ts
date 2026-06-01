import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("indexer monorepo layout", () => {
  test("keeps Envio source, config, schema, and tests under apps/indexer", () => {
    expect(existsSync("apps/indexer/config.yaml")).toBe(true);
    expect(existsSync("apps/indexer/schema.graphql")).toBe(true);
    expect(existsSync("apps/indexer/envio-env.d.ts")).toBe(true);
    expect(existsSync("apps/indexer/src/handlers/BlockHandlers.ts")).toBe(true);
    expect(existsSync("apps/indexer/tests/snapshot/global.test.ts")).toBe(true);

    expect(existsSync("config.yaml")).toBe(false);
    expect(existsSync("schema.graphql")).toBe(false);
    expect(existsSync("envio-env.d.ts")).toBe(false);
    expect(existsSync("src")).toBe(false);
  });

  test("delegates root Envio scripts to apps/indexer", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.codegen).toBe("pnpm --dir apps/indexer codegen");
    expect(packageJson.scripts.envio).toBe("pnpm --dir apps/indexer envio");
    expect(packageJson.scripts["envio:dev"]).toBe("pnpm --dir apps/indexer envio:dev");
    expect(packageJson.scripts["envio:start"]).toBe("pnpm --dir apps/indexer envio:start");
  });

  test("declares apps and packages as workspace packages", () => {
    const workspace = readFileSync("pnpm-workspace.yaml", "utf8");

    expect(workspace).toContain("- apps/*");
    expect(workspace).toContain("- packages/*");
  });
});
