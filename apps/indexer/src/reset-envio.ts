import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, rmdirSync, unlinkSync } from "node:fs";
import { createServer, request, type Server } from "node:http";
import { createConnection } from "node:net";
import { constants, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { superviseEnvio } from "./start-envio";

const STOP_TIMEOUT_MS = 30_000;

function controlPath(env: NodeJS.ProcessEnv): string {
  const identity = createHash("sha256")
    .update(process.cwd())
    .update("\0")
    .update(env.ENVIO_INDEXER_PORT ?? env.PORT ?? "")
    .digest("hex")
    .slice(0, 12);
  const directory = join(tmpdir(), `metrics-envio-${process.getuid?.()}-${identity}`);
  mkdirSync(directory, { mode: 0o700, recursive: true });
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) {
    throw new Error("Indexer reset control directory must be private to the indexer user");
  }
  return join(directory, "reset.sock");
}

export async function requestReset(env: NodeJS.ProcessEnv): Promise<number> {
  try {
    return await new Promise<number>((resolve, reject) => {
      const command = request(
        { socketPath: controlPath(env), method: "POST", path: "/reset" },
        (res) => {
          res.on("data", (chunk) => process.stdout.write(chunk));
          res.once("error", reject);
          res.once("end", () => resolve(res.statusCode === 200 ? 0 : 1));
        },
      );
      command.once("error", reject);
      command.end();
    });
  } catch {
    console.error(
      "Reset completion could not be confirmed. Check that the indexer wrapper is running and inspect its logs before retrying.",
    );
    return 1;
  }
}

async function listen(server: Server, socketPath: string): Promise<void> {
  const bind = () =>
    new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      server.once("error", onError);
      server.listen(socketPath, () => {
        server.off("error", onError);
        resolve();
      });
    });

  try {
    await bind();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    const recoveryLock = `${socketPath}.recovery-lock`;
    mkdirSync(recoveryLock, { mode: 0o700 });
    try {
      await new Promise<void>((resolve, reject) => {
        const probe = createConnection(socketPath);
        probe.once("connect", () => {
          probe.destroy();
          reject(new Error("An indexer reset control server is already running"));
        });
        probe.once("error", (cause: NodeJS.ErrnoException) => {
          if (cause.code === "ECONNREFUSED") resolve();
          else reject(cause);
        });
      });
      unlinkSync(socketPath);
      await bind();
    } finally {
      rmdirSync(recoveryLock);
    }
  }
}

function signalGroup(child: ChildProcess | undefined, signal: NodeJS.Signals | 0): boolean {
  if (!child?.pid) return false;
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    return false;
  }
}

async function stopGroup(child: ChildProcess | undefined, force = false): Promise<void> {
  if (!signalGroup(child, "SIGTERM")) return;
  const deadline = Date.now() + STOP_TIMEOUT_MS;
  while (signalGroup(child, 0)) {
    if (Date.now() >= deadline) {
      if (force) {
        signalGroup(child, "SIGKILL");
        return;
      }
      throw new Error("Envio process group did not stop within 30 seconds");
    }
    await delay(50);
  }
}

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

export async function runWithReset(
  args: string[],
  env: NodeJS.ProcessEnv,
  checkStorage: () => Promise<number>,
  supervise: typeof superviseEnvio,
): Promise<void> {
  const compatibility = await checkStorage();
  if (compatibility !== 0 && compatibility !== 78) {
    throw new Error("Envio storage compatibility check failed");
  }

  let child: ChildProcess | undefined;
  let migration: ChildProcess | undefined;
  let maintenance = compatibility === 78;
  let resetting = false;
  let shuttingDown = false;
  let run: Promise<void> | undefined;
  let stop = new AbortController();
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const spawnEnvio = (argv: string[], spawnEnv: NodeJS.ProcessEnv) =>
    spawn("envio", argv, { env: spawnEnv, detached: true, stdio: "inherit" });
  const drainChild = async (force = false) => {
    await stopGroup(child, force);
    child = undefined;
  };
  const start = () => {
    stop = new AbortController();
    run = supervise(args, env, {
      spawnEnvio: (argv, spawnEnv) => {
        child = spawnEnvio(argv, spawnEnv);
        return child;
      },
      drainChild,
      signal: stop.signal,
      kill: (_pid, signal) => {
        process.exitCode = 128 + constants.signals[signal];
      },
      exit: (code) => {
        process.exitCode = code;
      },
    })
      .catch(() => {
        console.error("Indexer supervision failed");
        process.exitCode = 1;
      })
      .finally(() => {
        if (!maintenance && !shuttingDown) finish();
      });
  };
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/reset") {
      res.writeHead(404).end();
      return;
    }
    if (resetting || shuttingDown) {
      res.writeHead(409).end("Reset rejected because shutdown or another reset is in progress.\n");
      return;
    }

    resetting = true;
    maintenance = true;
    stop.abort();
    try {
      await drainChild();
      await run;
      await stopGroup(migration);
      migration = undefined;
      if (shuttingDown) throw new Error("Indexer is shutting down");
      console.error("Ingestion stopped. Running Envio local db-migrate setup.");
      migration = spawnEnvio(["local", "db-migrate", "setup", ...args.slice(1)], env);
      const code = await waitForExit(migration);
      await stopGroup(migration);
      migration = undefined;
      if (code !== 0 || shuttingDown) throw new Error("Envio migration did not complete");
      maintenance = false;
      start();
      res.writeHead(200).end("Envio migration completed. Ingestion is restarting.\n");
    } catch {
      console.error("Envio reset failed. Ingestion remains paused.");
      res
        .writeHead(500)
        .end("Envio reset failed. Ingestion remains paused. Inspect the indexer logs.\n");
    } finally {
      resetting = false;
    }
  });
  const signalHandlers = new Map<NodeJS.Signals, () => void>();
  try {
    await listen(server, controlPath(env));
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      const handler = () => {
        if (shuttingDown) return;
        shuttingDown = true;
        stop.abort();
        Promise.allSettled([drainChild(true), stopGroup(migration, true)]).then(() => {
          process.exitCode = 128 + constants.signals[signal];
          finish();
        });
      };
      signalHandlers.set(signal, handler);
      process.on(signal, handler);
    }
    if (maintenance) {
      console.error(
        "Envio storage is incompatible. Ingestion is paused until an operator requests a reset.",
      );
    } else {
      start();
    }
    await finished;
  } finally {
    for (const [signal, handler] of signalHandlers) process.off(signal, handler);
    server.close();
    server.closeAllConnections();
  }
}
