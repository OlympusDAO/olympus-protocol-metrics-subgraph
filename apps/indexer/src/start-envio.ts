import { type ChildProcess, spawn } from "node:child_process";
import { createConnection } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { requestReset, runWithReset } from "./reset-envio";
import { validateIndexerEnv } from "./validate-env";

// Envio treats a failed batch write as a fatal error and exits (see
// IndexerState.res `recordWriteFailure` -> Bin.res `Main.FatalError`). It has no
// reconnect on the write loop, so a Postgres restart underneath a running
// indexer kills the process. Railway's restart policy alone is not enough: the
// container comes back faster than Postgres finishes crash recovery, burns its
// retries against a refused connection, and the service stays crashed. These
// bounds let the wrapper outlive a database restart instead.
export const MAX_ENVIO_RESPAWNS = 10;
export const MIN_HEALTHY_RUNTIME_MS = 60_000;
export const DATABASE_WAIT_TIMEOUT_MS = 10 * 60_000;
export const DATABASE_PROBE_INTERVAL_MS = 2_000;
export const DATABASE_PROBE_TIMEOUT_MS = 5_000;

export function prepareIndexerEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const railwayPort = env.PORT?.trim();
  const hasEnvioIndexerPort =
    env.ENVIO_INDEXER_PORT !== undefined && env.ENVIO_INDEXER_PORT.trim() !== "";
  if (!hasEnvioIndexerPort && railwayPort !== undefined && railwayPort !== "") {
    env.ENVIO_INDEXER_PORT = railwayPort;
  }

  return env;
}

export function resolveEnvioArgs(args: string[]): string[] {
  const resolved = args.length === 0 ? ["start"] : args;
  if (
    resolved[0] === "start" &&
    resolved.some((arg) => /^(?:-r|--(?:restart|reset)(?:=|$))/.test(arg))
  ) {
    throw new Error("Use start-envio.ts reset to reset the running indexer");
  }
  return resolved;
}

export function probeDatabase(
  host: string,
  port: number,
  timeoutMs: number = DATABASE_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const settle = (reachable: boolean) => {
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

export async function waitForDatabase(
  env: NodeJS.ProcessEnv,
  options: {
    probe?: (host: string, port: number) => Promise<boolean>;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
    logInfo?: (message: string) => void;
    timeoutMs?: number;
    intervalMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<boolean> {
  const probe = options.probe ?? ((host, port) => probeDatabase(host, port));
  const sleep = options.sleep ?? ((ms) => delay(ms, undefined, { signal: options.signal }));
  const now = options.now ?? Date.now;
  const logInfo = options.logInfo ?? console.error;
  const timeoutMs = options.timeoutMs ?? DATABASE_WAIT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DATABASE_PROBE_INTERVAL_MS;

  const host = env.ENVIO_PG_HOST?.trim() ?? "";
  const port = Number(env.ENVIO_PG_PORT);
  if (host === "" || !Number.isInteger(port) || port <= 0) {
    // validateIndexerEnv already rejects this before the first spawn; treat an
    // unusable address as "do not block" rather than hanging the container.
    return false;
  }

  const deadline = now() + timeoutMs;
  logInfo(`Waiting up to ${Math.round(timeoutMs / 1000)}s for Postgres at ${host}:${port}`);

  while (!options.signal?.aborted) {
    if (await probe(host, port)) {
      logInfo(`Postgres at ${host}:${port} is accepting connections`);
      return true;
    }

    if (now() >= deadline) {
      logInfo(`Postgres at ${host}:${port} still unreachable after ${timeoutMs}ms`);
      return false;
    }

    try {
      await sleep(intervalMs);
    } catch (error) {
      if (!options.signal?.aborted) throw error;
    }
  }
  return false;
}

export type EnvioSupervisorOptions = {
  spawnEnvio?: (args: string[], env: NodeJS.ProcessEnv) => Pick<ChildProcess, "on">;
  waitForDatabase?: (env: NodeJS.ProcessEnv) => Promise<boolean>;
  logError?: (message: string) => void;
  logInfo?: (message: string) => void;
  exit?: (code?: number) => void;
  signal?: AbortSignal;
  drainChild?: () => Promise<void>;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  pid?: number;
  now?: () => number;
  maxRespawns?: number;
  minHealthyRuntimeMs?: number;
};

export async function superviseEnvio(
  args: string[],
  env: NodeJS.ProcessEnv,
  options: EnvioSupervisorOptions = {},
): Promise<void> {
  const logError = options.logError ?? console.error;
  const logInfo = options.logInfo ?? console.error;
  const spawnEnvio =
    options.spawnEnvio ??
    ((spawnArgs, spawnEnv) => spawn("envio", spawnArgs, { env: spawnEnv, stdio: "inherit" }));
  const waitForDatabaseFn =
    options.waitForDatabase ??
    ((waitEnv) => waitForDatabase(waitEnv, { logInfo, signal: options.signal }));
  const exit = options.exit ?? process.exit;
  const maxRespawns = options.maxRespawns ?? MAX_ENVIO_RESPAWNS;
  const minHealthyRuntimeMs = options.minHealthyRuntimeMs ?? MIN_HEALTHY_RUNTIME_MS;
  const now = options.now ?? Date.now;

  const nextArgs = resolveEnvioArgs(args);
  let respawns = 0;

  while (!options.signal?.aborted) {
    const startedAt = now();
    const outcome = await runEnvioOnce(spawnEnvio(nextArgs, env), {
      kill: options.kill,
      pid: options.pid,
      signal: options.signal,
    });
    const runtimeMs = now() - startedAt;
    if (options.signal?.aborted) return;
    await options.drainChild?.();
    if (options.signal?.aborted) return;

    if (outcome.type === "signal") {
      // The container is being torn down. Existing behaviour: re-raise on self
      // so the exit status reflects the signal. Never respawn.
      return;
    }

    if (outcome.type === "spawnError") {
      logError(formatEnvioSpawnError(outcome.error));
      exit(1);
      return;
    }

    const code = outcome.code ?? 1;
    if (code === 0) {
      exit(0);
      return;
    }

    // Refund the crash budget after a run makes it through startup.
    const startedCleanly = runtimeMs >= minHealthyRuntimeMs;
    if (startedCleanly) {
      respawns = 0;
    }

    if (respawns >= maxRespawns) {
      logError(
        `Envio exited with code ${code} and has been respawned ${respawns} times; giving up so Railway can restart the container`,
      );
      exit(code);
      return;
    }

    logError(`Envio exited with code ${code} after ${runtimeMs}ms; checking Postgres before retry`);
    const databaseReachable = await waitForDatabaseFn(env);
    if (options.signal?.aborted) return;
    if (!databaseReachable) {
      logError("Postgres did not become reachable; exiting so Railway can restart the container");
      exit(code);
      return;
    }

    respawns += 1;
    logInfo(`Restarting envio (attempt ${respawns}/${maxRespawns}): envio ${nextArgs.join(" ")}`);
  }
}

type EnvioOutcome =
  | { type: "exit"; code: number | null }
  | { type: "signal"; signal: NodeJS.Signals }
  | { type: "spawnError"; error: Error & { code?: string } };

function runEnvioOnce(
  child: Pick<ChildProcess, "on">,
  options: {
    kill?: (pid: number, signal: NodeJS.Signals) => void;
    pid?: number;
    signal?: AbortSignal;
  } = {},
): Promise<EnvioOutcome> {
  const kill = options.kill ?? process.kill;
  const pid = options.pid ?? process.pid;

  return new Promise((resolve) => {
    child.on("error", (error) => {
      resolve({ type: "spawnError", error });
    });

    child.on("exit", (code, signal) => {
      if (signal !== null) {
        if (!options.signal?.aborted) kill(pid, signal);
        resolve({ type: "signal", signal });
        return;
      }
      resolve({ type: "exit", code });
    });
  });
}

export async function runIndexerStartup(
  args: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (args[0] === "reset") {
    if (args.length !== 1) throw new Error("Usage: start-envio.ts reset");
    process.exitCode = await requestReset(prepareIndexerEnv(env));
    return;
  }

  const preparedEnv = prepareIndexerEnv(env);
  validateIndexerEnv(preparedEnv);

  if (args[0] === "check") return;

  const startArgs = resolveEnvioArgs(args);
  if (
    startArgs[0] !== "start" ||
    startArgs.some((arg) => /^--(?:chain(?:=|$)|help$)/.test(arg) || arg === "-h")
  ) {
    await superviseEnvio(startArgs, preparedEnv);
    return;
  }

  const checkScript = fileURLToPath(new URL("./check-envio-storage.mjs", import.meta.url));
  const checkStorage = async () => {
    const runCheck = () =>
      new Promise<number>((resolve, reject) => {
        const check = spawn(process.execPath, [checkScript, ...startArgs], {
          env: preparedEnv,
          stdio: "inherit",
          timeout: 30_000,
          killSignal: "SIGKILL",
        });
        check.once("error", reject);
        check.once("exit", (code) => resolve(code ?? 1));
      });
    let status = await runCheck();
    if (status !== 0 && status !== 78 && (await waitForDatabase(preparedEnv))) {
      status = await runCheck();
    }
    return status;
  };
  await runWithReset(startArgs, preparedEnv, checkStorage, superviseEnvio);
}

export function formatEnvioSpawnError(error: Error & { code?: string }): string {
  if (error.code === "ENOENT") {
    return `Failed to start envio: envio binary was not found in PATH (${error.message})`;
  }
  return `Failed to start envio: ${error.code ? `${error.code}: ` : ""}${error.message}`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runIndexerStartup().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
