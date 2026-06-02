import { spawn } from "node:child_process";
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

  child.on("exit", (code, signal) => {
    if (signal !== null) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runIndexerStartup();
}
