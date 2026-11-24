import { spawn } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  };
  const child = spawn(process.execPath, [...nodeArgs, runtime, ...(idle ? ["idle"] : [])], {
    cwd,
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exit = new Promise<number | null>((resolve) => child.once("exit", resolve));
  const closed = new Promise<number | null>((resolve) => child.once("close", resolve));
  const shutdown = () => child.kill("SIGTERM");
  return {
    cwd,
    child,
    closed,
    events: () => readFileSync(join(cwd, "events"), "utf8").trim().split("\n").filter(Boolean),
    stderr: () => stderr,
    migrationPid: () => Number(readFileSync(join(cwd, "migration-pid"), "utf8")),
    removeMarker: (name: string) => rmSync(join(cwd, name)),
    exit,
    shutdown,
    restart: (preload?: string) =>
      spawn(process.execPath, [...(preload ? ["--import", preload] : []), ...nodeArgs, runtime], {
        cwd,
        env,
        stdio: "ignore",
      }),
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

async function staleFixture() {
  const run = fixture(["bounded"], true);
  try {
    await expect.poll(run.stderr, { timeout: 8000 }).toContain("Fixture control ready");
    run.child.kill("SIGKILL");
    await run.closed;
    const directory = readdirSync(run.cwd).find((name) => name.startsWith("metrics-envio-"));
    if (!directory) throw new Error("Missing fixture control directory");
    const socket = join(run.cwd, directory, "reset.sock");
    expect(lstatSync(socket).isSocket()).toBe(true);
    return { run, socket };
  } catch (error) {
    await run.close();
    throw error;
  }
}

test("forwards a native startup refusal without resetting or parking the wrapper", async () => {
  const run = fixture(["refuse"]);
  try {
    expect(await run.exit).toBe(2);
    expect(run.events()).toEqual(["start --config fixture.yaml"]);
    expect(run.stderr()).not.toContain("Ingestion is paused");
  } finally {
    await run.close();
  }
}, 25_000);

test("recovers a stale control socket after a single wrapper crashes", async () => {
  const { run, socket } = await staleFixture();
  const child = run.restart();
  const closed = new Promise<number | null>((resolve) => child.once("close", resolve));
  try {
    expect(await closed).toBe(0);
    expect(run.events()).toEqual(["start --config fixture.yaml"]);
    expect(existsSync(`${socket}.recovery-lock`)).toBe(false);
  } finally {
    child.kill("SIGTERM");
    await closed;
    await run.close();
  }
}, 25_000);

test("serializes competing recoverers of a stale control socket before ingestion", async () => {
  const { run, socket } = await staleFixture();
  const preload = join(run.cwd, "hold-probe.mjs");
  writeFileSync(
    preload,
    `
import net from "node:net";
import { existsSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
const connect = net.createConnection;
net.createConnection = (...args) => {
  const socket = connect(...args);
  const emit = socket.emit.bind(socket);
  socket.emit = (event, ...values) => {
    if (event === "error" && values[0]?.code === "ECONNREFUSED") {
      writeFileSync("probe-held", "");
      const timer = setInterval(() => {
        if (!existsSync("release-probe")) return;
        clearInterval(timer);
        emit(event, ...values);
      }, 5);
      return true;
    }
    return emit(event, ...values);
  };
  return socket;
};
syncBuiltinESMExports();
`,
  );
  const first = run.restart(preload);
  const firstClosed = new Promise<number | null>((resolve) => first.once("close", resolve));
  let second: ReturnType<typeof spawn> | undefined;
  let secondClosed: Promise<number | null> | undefined;
  try {
    await expect.poll(() => existsSync(join(run.cwd, "probe-held")), { timeout: 8000 }).toBe(true);
    const contender = run.restart();
    second = contender;
    secondClosed = new Promise((resolve) => contender.once("close", resolve));
    expect(await secondClosed).not.toBe(0);
    expect(run.events()).toEqual([]);
    expect(existsSync(`${socket}.recovery-lock`)).toBe(true);
    writeFileSync(join(run.cwd, "release-probe"), "");
    expect(await firstClosed).toBe(0);
    expect(run.events()).toEqual(["start --config fixture.yaml"]);
    expect(existsSync(`${socket}.recovery-lock`)).toBe(false);
  } finally {
    writeFileSync(join(run.cwd, "release-probe"), "");
    first.kill("SIGTERM");
    second?.kill("SIGTERM");
    await Promise.all([firstClosed, secondClosed]);
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
