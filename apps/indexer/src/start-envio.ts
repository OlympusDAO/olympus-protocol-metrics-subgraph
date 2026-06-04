import { type ChildProcess, spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { validateIndexerEnv } from "./validate-env";

export function prepareIndexerEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const railwayPort = env.PORT?.trim();
  const hasEnvioIndexerPort = env.ENVIO_INDEXER_PORT !== undefined && env.ENVIO_INDEXER_PORT.trim() !== "";
  if (!hasEnvioIndexerPort && railwayPort !== undefined && railwayPort !== "") {
    env.ENVIO_INDEXER_PORT = railwayPort;
  }

  return env;
}

export function isRailwayRuntime(env: NodeJS.ProcessEnv): boolean {
  return Object.entries(env).some(([key, value]) => key.startsWith("RAILWAY_") && isPresent(value));
}

export function resolveEnvioArgs(args: string[], env: NodeJS.ProcessEnv = process.env): string[] {
  const resolvedArgs = args.length === 0 ? ["start"] : args;
  if (!isRailwayRuntime(env) || resolvedArgs[0] !== "start" || hasResetFlag(resolvedArgs)) {
    return resolvedArgs;
  }

  return [...resolvedArgs, "-r"];
}

export function runIndexerStartup(args: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): void {
  const preparedEnv = prepareIndexerEnv(env);
  validateIndexerEnv(preparedEnv);

  if (args[0] === "check") {
    return;
  }

  const child = spawn("envio", resolveEnvioArgs(args, preparedEnv), {
    env: preparedEnv,
    stdio: "inherit",
  });

  attachEnvioChildHandlers(child);
}

export function attachEnvioChildHandlers(
  child: Pick<ChildProcess, "on">,
  options: {
    logError?: (message: string) => void;
    exit?: (code?: number) => never;
    kill?: (pid: number, signal: NodeJS.Signals) => void;
    pid?: number;
  } = {},
): void {
  const logError = options.logError ?? console.error;
  const exit = options.exit ?? process.exit;
  const kill = options.kill ?? process.kill;
  const pid = options.pid ?? process.pid;

  child.on("error", (error) => {
    logError(formatEnvioSpawnError(error));
    exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal !== null) {
      kill(pid, signal);
      return;
    }
    exit(code ?? 1);
  });
}

export function formatEnvioSpawnError(error: Error & { code?: string }): string {
  if (error.code === "ENOENT") {
    return `Failed to start envio: envio binary was not found in PATH (${error.message})`;
  }
  return `Failed to start envio: ${error.code ? `${error.code}: ` : ""}${error.message}`;
}

function hasResetFlag(args: string[]): boolean {
  return args.includes("-r") || args.includes("--reset");
}

function isPresent(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runIndexerStartup();
}
