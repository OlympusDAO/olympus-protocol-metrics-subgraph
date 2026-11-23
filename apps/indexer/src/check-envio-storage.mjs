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
  if (version !== "3.18.1") throw new Error("Review the storage check before upgrading Envio");
  await native("Env");
  const Core = await native("Core");
  const result = await Core.runCli(process.argv.slice(2));
  if (result !== null) {
    const command = JSON.parse(result);
    if (command.kind !== "start") throw new Error("Expected start command");
    if (!command.reset) {
      const Config = await native("Config");
      Config.prime(command.config);
      process.chdir(command.cwd);
      Object.assign(process.env, command.env);
      const [Storage, ResumePlan, ChainMap, Logger] = await Promise.all([
        native("Storage"),
        native("ResumePlan"),
        native("ChainMap"),
        native("Logger"),
      ]);
      const config = Config.load();
      storage = Storage.makeStorageFromEnv(config, Logger.makeInMemory(), undefined, false, 1);
      const holding = await storage.holding();
      if (["Stranded", "Diverged", "Outdated"].includes(holding)) {
        process.exitCode = 78;
      } else if (holding === "Nothing") {
        if (config.isolated) process.exitCode = 78;
      } else if (holding === "Initialized") {
        const stored = await storage.readStoredConfig();
        const chains = ChainMap.values(config.chainMap);
        const plan = ResumePlan.make(
          stored,
          config.envioInfo,
          chains,
          config.contractMapping,
          config.isolated,
        );
        if (plan?.TAG === "Incompatible") {
          process.exitCode = 78;
        } else {
          // This native read does not take over storage. Compare addresses before any mutation.
          const state = await storage.resumeInitialState(
            chains.map((chain) => chain.id),
            stored.contractMapping,
          );
          const changed = ResumePlan.changedConfigAddressPaths(
            chains.flatMap((chain) => {
              const resumed = state.chains.find((entry) => entry.id === chain.id);
              return resumed ? [[chain, resumed.addressRows]] : [];
            }),
            config.ecosystem.name,
            stored.contractMapping,
            config.lowercaseAddresses,
          );
          if (changed.length) process.exitCode = 78;
        }
      } else {
        throw new Error("Invalid storage holding state");
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
