import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { validateIndexerEnv } from "./validate-env";

export function prepareIndexerEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const railwayPort = env.PORT?.trim();
  const hasEnvioIndexerPort =
    env.ENVIO_INDEXER_PORT !== undefined && env.ENVIO_INDEXER_PORT.trim() !== "";
  if (!hasEnvioIndexerPort && railwayPort !== undefined && railwayPort !== "") {
    env.ENVIO_INDEXER_PORT = railwayPort;
  }

  return env;
}

function runIndexerStartup(args: string[], env: NodeJS.ProcessEnv): void {
  const preparedEnv = prepareIndexerEnv(env);
  validateIndexerEnv(preparedEnv);
  if (args[0] === "check") return;

  const envio = createRequire(import.meta.url).resolve("envio/bin.mjs");
  if (!process.execve) throw new Error("Envio startup requires process.execve");
  process.execve(
    process.execPath,
    [process.execPath, envio, ...(args.length === 0 ? ["start"] : args)],
    preparedEnv,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runIndexerStartup(process.argv.slice(2), process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
