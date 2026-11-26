import { spawn } from "node:child_process";
import { lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const require = createRequire(import.meta.url);
const nodeArgs = ["--import", require.resolve("tsx")];
const startup = fileURLToPath(new URL("../src/start-envio.ts", import.meta.url));
const runtime = fileURLToPath(new URL("./fixtures/reset-runtime.ts", import.meta.url));
const fakeEnvio = fileURLToPath(new URL("./fixtures/reset-envio.mjs", import.meta.url));

function fixture(files: string[] = [], idle = false) {
  const cwd = mkdtempSync(join(tmpdir(), "metrics-reset-"));
  // The fixture executable is written to a private directory on the child's PATH.
  writeFileSync(join(cwd, "envio"), readFileSync(fakeEnvio), { mode: 0o700, flag: "w" });
  writeFileSync(join(cwd, "events"), "");
  for (const file of files) writeFileSync(join(cwd, file), "");
  const env = {
    ...process.env,
    // Both subprocesses share the private cwd. Keep the Unix socket path short.
    TMPDIR: ".",
    PATH: `${cwd}:${process.env.PATH}`,
    PORT: "9898",
    ENVIO_INDEXER_PORT: "9898",
    ENVIO_PG_HOST: "",
    ENVIO_PG_PORT: "",
  };
  const launch = (idle = false) => {
    const child = spawn(process.execPath, [...nodeArgs, runtime, ...(idle ? ["idle"] : [])], {
      cwd,
      env,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    return {
      child,
      closed: new Promise<number | null>((resolve) => child.once("close", resolve)),
      stderr: () => stderr,
    };
  };
  const { child, closed, stderr } = launch(idle);
  const exit = new Promise<number | null>((resolve) => child.once("exit", resolve));
  const shutdown = () => child.kill("SIGTERM");
  return {
    child,
    closed,
    events: () => readFileSync(join(cwd, "events"), "utf8").trim().split("\n").filter(Boolean),
    stderr,
    migrationPid: () => Number(readFileSync(join(cwd, "migration-pid"), "utf8")),
    removeMarker: (name: string) => rmSync(join(cwd, name)),
    exit,
    shutdown,
    restart: () => launch(),
    socket() {
      const directory = readdirSync(cwd).find((name) => name.startsWith("metrics-envio-"));
      if (!directory) throw new Error("Missing fixture control directory");
      return join(cwd, directory, "reset.sock");
    },
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
      shutdown();
      await closed;
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}

test("keeps reset control alive after native failure until an explicit reset", async () => {
  const run = fixture(["refuse", "bounded"]);
  try {
    await expect.poll(run.stderr, { timeout: 8000 }).toContain("Ingestion is paused");
    expect(run.child.exitCode).toBeNull();
    expect(run.events()).toEqual(["start --config fixture.yaml"]);
    run.removeMarker("refuse");
    expect(await run.reset()).toBe(0);
    expect(await run.exit).toBe(0);
    expect(run.events()).toEqual([
      "start --config fixture.yaml",
      "migration local db-migrate setup --config fixture.yaml",
      "start --config fixture.yaml",
    ]);
  } finally {
    await run.close();
  }
}, 25_000);

test("SIGTERM terminates a paused native failure without running a migration", async () => {
  const run = fixture(["refuse"]);
  try {
    await expect.poll(run.stderr, { timeout: 8000 }).toContain("Ingestion is paused");
    run.shutdown();
    expect(await run.exit).toBe(143);
    expect(run.events()).toEqual(["start --config fixture.yaml"]);
  } finally {
    await run.close();
  }
}, 25_000);

test("leaves a stale control socket in place and refuses to start or reset", async () => {
  const run = fixture(["bounded"], true);
  try {
    await expect.poll(run.stderr, { timeout: 8000 }).toContain("Fixture control ready");
    run.child.kill("SIGKILL");
    await run.closed;
    const socket = run.socket();
    const original = lstatSync(socket);
    expect(original.isSocket()).toBe(true);

    const replacement = run.restart();
    try {
      expect(await replacement.closed).toBe(1);
      expect(replacement.stderr()).toContain(
        "Verify the previous wrapper and ingestion have stopped",
      );
      expect(replacement.stderr()).not.toContain(basename(dirname(socket)));
      expect(lstatSync(socket).ino).toBe(original.ino);
      expect(readdirSync(dirname(socket))).toEqual(["reset.sock"]);
      expect(await run.reset()).toBe(1);
      expect(run.events()).toEqual([]);
    } finally {
      replacement.child.kill("SIGTERM");
      await replacement.closed;
    }
  } finally {
    await run.close();
  }
}, 25_000);

test("rejects a competing wrapper and leaves the live reset socket usable", async () => {
  const run = fixture(["bounded"], true);
  try {
    await expect.poll(run.stderr, { timeout: 8000 }).toContain("Fixture control ready");
    const socket = run.socket();
    const original = lstatSync(socket);
    const contender = run.restart();
    try {
      expect(await contender.closed).toBe(1);
      expect(contender.stderr()).toContain(
        "Verify the previous wrapper and ingestion have stopped",
      );
    } finally {
      contender.child.kill("SIGTERM");
      await contender.closed;
    }
    expect(run.child.exitCode).toBeNull();
    expect(lstatSync(socket).ino).toBe(original.ino);
    expect(readdirSync(dirname(socket))).toEqual(["reset.sock"]);
    expect(run.events()).toEqual([]);
    expect(await run.reset()).toBe(0);
    expect(await run.exit).toBe(0);
    expect(run.events()).toEqual([
      "migration local db-migrate setup --config fixture.yaml",
      "start --config fixture.yaml",
    ]);
  } finally {
    await run.close();
  }
}, 25_000);

test.skipIf(process.platform !== "linux")(
  "drains the complete process group before migration and rejects concurrent reset",
  async () => {
    const run = fixture(["hold"]);
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

test("SIGTERM stops an active reset migration without restarting ingestion", async () => {
  const run = fixture(["hold"], true);
  const migration = "migration local db-migrate setup --config fixture.yaml";
  try {
    await expect.poll(run.stderr, { timeout: 8000 }).toContain("Fixture control ready");
    const reset = run.reset();
    await expect.poll(run.events, { timeout: 8000 }).toContain(migration);
    const migrationPid = run.migrationPid();
    const groupExists = () => {
      try {
        return process.kill(-migrationPid, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
        throw error;
      }
    };
    expect(groupExists()).toBe(true);

    run.shutdown();
    await expect.poll(groupExists, { timeout: 8000 }).toBe(false);
    expect(await run.exit).toBe(143);
    expect(await reset).toBe(1);
    expect(run.events()).toEqual([migration]);
  } finally {
    run.removeMarker("hold");
    await run.close();
  }
}, 25_000);

test.skipIf(process.platform !== "linux")(
  "keeps ingestion paused after an explicit migration failure and permits a reset retry",
  async () => {
    const run = fixture(["fail"], true);
    try {
      await expect.poll(run.stderr, { timeout: 8000 }).toContain("Fixture control ready");
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
    const run = fixture(["bounded"]);
    try {
      expect(await run.exit).toBe(0);
      expect(run.events()).toEqual(["start --config fixture.yaml"]);
    } finally {
      await run.close();
    }
  },
  25_000,
);
