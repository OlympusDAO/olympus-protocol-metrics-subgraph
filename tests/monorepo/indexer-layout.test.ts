import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("indexer monorepo layout", () => {
  test("keeps Envio source, config, schema, and tests under apps/indexer", () => {
    expect(existsSync("apps/indexer/config.yaml")).toBe(true);
    expect(existsSync("apps/indexer/schema.graphql")).toBe(true);
    expect(existsSync("apps/indexer/envio-env.d.ts")).toBe(true);
    expect(existsSync("apps/indexer/.env.sample")).toBe(true);
    expect(existsSync("apps/indexer/src/start-envio.ts")).toBe(true);
    expect(existsSync("apps/indexer/src/validate-env.ts")).toBe(true);
    expect(existsSync("apps/indexer/src/handlers/BlockHandlers.ts")).toBe(true);
    expect(existsSync("apps/indexer/tests/snapshot/global.test.ts")).toBe(true);

    expect(existsSync(".env.sample")).toBe(false);
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

  test("runs indexer env validation before Envio starts", () => {
    const packageJson = JSON.parse(readFileSync("apps/indexer/package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["env:check"]).toBe("tsx src/start-envio.ts check");
    expect(packageJson.scripts["envio:dev"]).toBe("ENVIO_TUI=${ENVIO_TUI:-false} tsx src/start-envio.ts dev");
    expect(packageJson.scripts["envio:start"]).toBe("tsx src/start-envio.ts start");
  });

  test("declares apps and packages as workspace packages", () => {
    const workspace = readFileSync("pnpm-workspace.yaml", "utf8");

    expect(workspace).toContain("- apps/*");
    expect(workspace).toContain("- packages/*");
  });

  test("keeps app and package tests next to their owning code", () => {
    expect(existsSync("apps/metrics-api/tests/server.test.ts")).toBe(true);
    expect(existsSync("apps/metrics-publisher/tests/publisher.test.ts")).toBe(true);
    expect(existsSync("apps/client/tests/client.test.ts")).toBe(true);
    expect(existsSync("packages/metrics-artifacts/tests/date-ranges.test.ts")).toBe(true);
    expect(existsSync("packages/metrics-artifacts/tests/legacy-shape.test.ts")).toBe(true);
    expect(existsSync("packages/metrics-artifacts/tests/openapi.test.ts")).toBe(true);

    expect(existsSync("tests/metrics-api")).toBe(false);
    expect(existsSync("tests/metrics-publisher")).toBe(false);
    expect(existsSync("tests/client")).toBe(false);
  });
});
