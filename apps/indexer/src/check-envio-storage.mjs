import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Envio has no public compatibility-check API. Keep this adapter pinned and
// isolated from the supervisor: native modules capture environment on import.
const require = createRequire(import.meta.url);
const envioRoot = dirname(require.resolve("envio/package.json"));
const native = (name) => import(pathToFileURL(join(envioRoot, "src", `${name}.res.mjs`)));

let storage;
try {
  const { version } = JSON.parse(readFileSync(join(envioRoot, "package.json"), "utf8"));
  if (version !== "3.14.0") throw new Error("Review the storage check before upgrading Envio");
  const Core = await native("Core");
  const result = await Core.runCli(process.argv.slice(2));
  if (result !== null) {
    const command = JSON.parse(result);
    if (command.kind !== "start") throw new Error("Expected start command");
    if (!command.reset) {
      process.chdir(command.cwd);
      Object.assign(process.env, command.env);
      const [Config, PgStorage, ResumePlan, ChainMap] = await Promise.all([
        native("Config"),
        native("PgStorage"),
        native("ResumePlan"),
        native("ChainMap"),
      ]);
      Config.prime(command.config);
      const config = Config.load();
      storage = PgStorage.makeStorageFromEnv(config, PgStorage.makeClient(1));
      if (await storage.isInitialized()) {
        const plan = ResumePlan.make(
          await storage.readStoredConfig(),
          config.envioInfo,
          ChainMap.values(config.chainMap),
          config.contractMapping,
          config.lowercaseAddresses,
          config.isolated,
        );
        if (plan?.TAG === "Incompatible") process.exitCode = 78;
      }
    }
  }
} catch {
  // Exceptions can contain credentials; omit them and the parsed config from
  // this error. Native CLI diagnostics still use the inherited log stream.
  console.error(
    "Cannot check Envio storage compatibility. Check the pinned version, configuration and database access. No reset was performed.",
  );
  process.exitCode = 1;
} finally {
  try {
    if (storage) await storage.close();
  } catch {
    console.error("Cannot close the Envio storage check connection.");
    process.exitCode = 1;
  }
}
