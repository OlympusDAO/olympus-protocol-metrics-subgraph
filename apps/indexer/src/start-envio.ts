import { type ChildProcess, spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { validateIndexerEnv } from "./validate-env";

export function prepareIndexerEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const railwayDeploymentId = env.RAILWAY_DEPLOYMENT_ID?.trim();
  const hasSchema = env.ENVIO_PG_SCHEMA !== undefined && env.ENVIO_PG_SCHEMA.trim() !== "";
  if (!hasSchema && railwayDeploymentId !== undefined && railwayDeploymentId !== "") {
    env.ENVIO_PG_SCHEMA = railwayDeploymentId;
  }

  const railwayPort = env.PORT?.trim();
  const hasEnvioIndexerPort = env.ENVIO_INDEXER_PORT !== undefined && env.ENVIO_INDEXER_PORT.trim() !== "";
  if (!hasEnvioIndexerPort && railwayPort !== undefined && railwayPort !== "") {
    env.ENVIO_INDEXER_PORT = railwayPort;
  }

  return env;
}

export function resolveEnvioArgs(args: string[]): string[] {
  return args.length === 0 ? ["start"] : args;
}

export function runIndexerStartup(args: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): void {
  const preparedEnv = prepareIndexerEnv(env);
  validateIndexerEnv(preparedEnv);

  if (args[0] === "check") {
    return;
  }

  const child = spawn("envio", resolveEnvioArgs(args), {
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runIndexerStartup();
}
