import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const require = createRequire(import.meta.url);
const nodeArgs = ["--import", require.resolve("tsx")];
const startup = fileURLToPath(new URL("../src/start-envio.ts", import.meta.url));
const runtime = fileURLToPath(new URL("./fixtures/reset-runtime.ts", import.meta.url));
const fakeEnvio = fileURLToPath(new URL("./fixtures/reset-envio.mjs", import.meta.url));

function fixture(compatibility: number, files: string[] = []) {
  const cwd = mkdtempSync(join(tmpdir(), "metrics-reset-"));
  // The fixture executable is written to a private directory on the child's PATH.
  writeFileSync(join(cwd, "envio"), readFileSync(fakeEnvio), { mode: 0o700, flag: "w" });
  writeFileSync(join(cwd, "events"), "");
  for (const file of files) writeFileSync(join(cwd, file), "");
  const env = {
    ...process.env,
    TMPDIR: cwd,
    PATH: `${cwd}:${process.env.PATH}`,
    PORT: "9898",
    ENVIO_INDEXER_PORT: "9898",
  };
  const child = spawn(process.execPath, [...nodeArgs, runtime, String(compatibility)], {
    cwd,
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exit = new Promise<number | null>((resolve) => child.once("exit", resolve));
  return {
    events: () => readFileSync(join(cwd, "events"), "utf8").trim().split("\n").filter(Boolean),
    stderr: () => stderr,
    removeMarker: (name: string) => rmSync(join(cwd, name)),
    exit,
    reset: () =>
      new Promise<number | null>((resolve) => {
        const caller = spawn(process.execPath, [...nodeArgs, startup, "reset"], {
          cwd,
          env: { ...env, ENVIO_INDEXER_PORT: "" },
          stdio: "ignore",
        });
        caller.once("exit", resolve);
      }),
    async close() {
      child.kill("SIGTERM");
      await exit;
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}

test.skipIf(process.platform !== "linux")(
  "drains the complete process group before migration and rejects concurrent reset",
  async () => {
    const run = fixture(0, ["hold"]);
    try {
      await expect.poll(run.events, { timeout: 8000 }).toContain("worker started");
      const first = run.reset();
      await expect
        .poll(run.events, { timeout: 8000 })
        .toContain("migration local db-migrate setup --config fixture.yaml");
      expect(await run.reset()).toBe(1);
      run.removeMarker("hold");
      expect(await first).toBe(0);
      await expect
        .poll(run.events, { timeout: 8000 })
        .toEqual([
          "start --config fixture.yaml",
          "worker started",
          "start stopping",
          "worker stopped",
          "start stopped",
          "migration local db-migrate setup --config fixture.yaml",
          "start --config fixture.yaml",
          "worker started",
        ]);
    } finally {
      await run.close();
    }
  },
  25_000,
);

test.skipIf(process.platform !== "linux")(
  "accepts explicit reset while incompatible and stays paused after migration failure",
  async () => {
    const run = fixture(78, ["fail"]);
    try {
      await expect.poll(run.stderr, { timeout: 8000 }).toContain("storage is incompatible");
      expect(run.events()).toEqual([]);
      expect(await run.reset()).toBe(1);
      expect(run.events()).toEqual(["migration local db-migrate setup --config fixture.yaml"]);
      run.removeMarker("fail");
      expect(await run.reset()).toBe(0);
      await expect
        .poll(run.events, { timeout: 8000 })
        .toEqual([
          "migration local db-migrate setup --config fixture.yaml",
          "migration local db-migrate setup --config fixture.yaml",
          "start --config fixture.yaml",
          "worker started",
        ]);
    } finally {
      await run.close();
    }
  },
  25_000,
);

test.skipIf(process.platform !== "linux")(
  "forwards a clean bounded ingestion exit while the reset listener is idle",
  async () => {
    const run = fixture(0, ["bounded"]);
    try {
      expect(await run.exit).toBe(0);
      expect(run.events()).toEqual(["start --config fixture.yaml"]);
    } finally {
      await run.close();
    }
  },
  25_000,
);
