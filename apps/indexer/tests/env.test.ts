import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";

import {
  type EnvioSupervisorOptions,
  formatEnvioSpawnError,
  prepareIndexerEnv,
  resolveEnvioArgs,
  superviseEnvio,
  waitForDatabase,
} from "../src/start-envio";
import { validateIndexerEnv } from "../src/validate-env";

const validEnv: NodeJS.ProcessEnv = {
  ENVIO_API_TOKEN: "token",
  ENVIO_PG_HOST: "postgres",
  ENVIO_PG_PORT: "5432",
  ENVIO_PG_USER: "postgres",
  ENVIO_PG_PASSWORD: "password",
  ENVIO_PG_DATABASE: "envio",
  ENVIO_PG_SCHEMA: "public",
  ENVIO_PG_SSL_MODE: "false",
  HASURA_GRAPHQL_ENDPOINT: "http://hasura:8080/v1/metadata",
  HASURA_GRAPHQL_ADMIN_SECRET: "secret",
  ENVIO_ARBITRUM_RPC_URL: "https://arbitrum.example.com",
  ENVIO_ROBINHOOD_RPC_URL: "https://robinhood.example.com",
  ENVIO_BERACHAIN_RPC_URL: "https://berachain.example.com",
  ENVIO_BASE_RPC_URL: "https://base.example.com",
  ENVIO_POLYGON_RPC_URL: "https://polygon.example.com",
  ENVIO_FANTOM_RPC_URL: "https://fantom.example.com",
  ENVIO_ETHEREUM_RPC_URL: "https://ethereum.example.com",
};

describe("indexer env validation", () => {
  test("accepts the required indexer service env variables", () => {
    expect(() => validateIndexerEnv(validEnv)).not.toThrow();
  });

  test("forbids explicit Railway schemas so Envio uses its default schema", () => {
    expect(() =>
      validateIndexerEnv({
        ...validEnv,
        ENVIO_INDEXER_PORT: "9898",
        ENVIO_PG_SCHEMA: "public",
        PORT: "9898",
        RAILWAY_SERVICE_ID: "railway-service-1",
      }),
    ).toThrow("ENVIO_PG_SCHEMA must not be set on Railway");

    expect(() =>
      validateIndexerEnv({
        ...validEnv,
        ENVIO_INDEXER_PORT: "9898",
        ENVIO_PG_SCHEMA: "",
        PORT: "9898",
        RAILWAY_SERVICE_ID: "railway-service-1",
      }),
    ).not.toThrow();
  });

  test("does not inject the Railway deployment id as the schema", () => {
    const env = prepareIndexerEnv({
      ...validEnv,
      ENVIO_INDEXER_PORT: "9898",
      ENVIO_PG_SCHEMA: "",
      PORT: "9898",
      RAILWAY_DEPLOYMENT_ID: "railway-deployment-1",
    });

    expect(env.ENVIO_PG_SCHEMA).toBe("");
    expect(() => validateIndexerEnv(env)).not.toThrow();
  });

  test("maps Railway PORT to Envio's indexer healthcheck port", () => {
    const env = prepareIndexerEnv({
      ...validEnv,
      ENVIO_INDEXER_PORT: "",
      ENVIO_PG_SCHEMA: "",
      PORT: "9898",
      RAILWAY_SERVICE_ID: "railway-service-1",
    });

    expect(env.ENVIO_INDEXER_PORT).toBe("9898");
    expect(() => validateIndexerEnv(env)).not.toThrow();

    expect(() =>
      validateIndexerEnv({
        ...validEnv,
        ENVIO_PG_SCHEMA: "",
        PORT: "",
        RAILWAY_SERVICE_ID: "railway-service-1",
      }),
    ).toThrow("PORT must be set when running on Railway");

    expect(() =>
      validateIndexerEnv({
        ...validEnv,
        ENVIO_INDEXER_PORT: "9898",
        PORT: "4321",
      }),
    ).toThrow("ENVIO_INDEXER_PORT must match PORT");
  });

  test("defaults local startup to envio start without resetting the database", () => {
    expect(resolveEnvioArgs([])).toEqual(["start"]);
    expect(resolveEnvioArgs(["start"])).toEqual(["start"]);
    expect(resolveEnvioArgs(["dev"])).toEqual(["dev"]);
    expect(resolveEnvioArgs(["--directory", "start", "dev"])).toEqual([
      "--directory",
      "start",
      "dev",
    ]);
  });

  test.each(["-r", "-rd", "--restart", "--reset"])(
    "requires the reset command instead of %s on start",
    (flag) => {
      expect(() => resolveEnvioArgs(["start", flag])).toThrow("Use start-envio.ts reset");
    },
  );

  test.each([
    ["--directory", "."],
    ["--directory=."],
    ["-d", "."],
    ["-d."],
    ["--config", "config.yaml"],
    ["--config=config.yaml"],
  ])("applies start guards after native global options %j", (...globalOptions) => {
    expect(resolveEnvioArgs([...globalOptions, "start"])).toEqual(["start", ...globalOptions]);
    expect(() => resolveEnvioArgs([...globalOptions, "start", "--restart"])).toThrow(
      "Use start-envio.ts reset",
    );
  });

  test("formats spawn failures loudly before Envio starts", () => {
    expect(
      formatEnvioSpawnError(Object.assign(new Error("spawn envio ENOENT"), { code: "ENOENT" })),
    ).toContain("envio binary was not found in PATH");
    expect(
      formatEnvioSpawnError(Object.assign(new Error("permission denied"), { code: "EACCES" })),
    ).toBe("Failed to start envio: EACCES: permission denied");
  });

  test("fails loudly when required env variables are missing", () => {
    expect(() =>
      validateIndexerEnv({
        ...validEnv,
        ENVIO_API_TOKEN: "",
        ENVIO_ETHEREUM_RPC_URL: "   ",
      }),
    ).toThrow("Missing required environment variables: ENVIO_API_TOKEN, ENVIO_ETHEREUM_RPC_URL");
  });

  test("rejects malformed URLs and ports before Envio starts", () => {
    expect(() =>
      validateIndexerEnv({
        ...validEnv,
        ENVIO_PG_PORT: "0",
        ENVIO_BASE_RPC_URL: "not-a-url",
      }),
    ).toThrow("Invalid URL environment variables: ENVIO_BASE_RPC_URL");

    expect(() =>
      validateIndexerEnv({
        ...validEnv,
        ENVIO_INDEXER_PORT: "0",
      }),
    ).toThrow("Invalid positive integer environment variables: ENVIO_INDEXER_PORT");
  });
});

const railwayEnv: NodeJS.ProcessEnv = {
  ...validEnv,
  ENVIO_INDEXER_PORT: "9898",
  ENVIO_PG_SCHEMA: "",
  PORT: "9898",
  RAILWAY_SERVICE_ID: "railway-service-1",
};

type ScriptedRun = {
  code?: number | null;
  signal?: NodeJS.Signals;
  error?: Error & { code?: string };
  runtimeMs?: number;
};

type EnvioChild = ReturnType<NonNullable<EnvioSupervisorOptions["spawnEnvio"]>>;

function scriptedChild(run: ScriptedRun): EnvioChild {
  const child = {
    on(event: string, handler: (...args: never[]) => void) {
      if (event === "exit" && run.error === undefined) {
        queueMicrotask(() =>
          (handler as (code: number | null, signal: NodeJS.Signals | null) => void)(
            run.code ?? null,
            run.signal ?? null,
          ),
        );
      }
      if (event === "error" && run.error !== undefined) {
        queueMicrotask(() => (handler as (error: Error) => void)(run.error as Error));
      }
      return child;
    },
  };

  return child as unknown as EnvioChild;
}

function harness(runs: ScriptedRun[], databaseReachable: boolean[] = []) {
  const spawnedArgs: string[][] = [];
  const logged: string[] = [];
  const exits: number[] = [];
  let clock = 0;
  let runIndex = 0;
  let waitIndex = 0;

  const options = {
    spawnEnvio: (args: string[]) => {
      const run = runs[runIndex++];
      if (run === undefined) {
        throw new Error(`envio was spawned ${runIndex} times but only ${runs.length} are scripted`);
      }
      spawnedArgs.push(args);
      clock += run.runtimeMs ?? 0;
      return scriptedChild(run);
    },
    waitForDatabase: async () => databaseReachable[waitIndex++] ?? true,
    logError: (message: string) => logged.push(message),
    logInfo: (message: string) => logged.push(message),
    exit: ((code?: number) => {
      exits.push(code ?? 0);
      throw new Error(`exit ${code}`);
    }) as (code?: number) => never,
    kill: () => {},
    pid: 1234,
    now: () => clock,
  };

  return { options, spawnedArgs, logged, exits };
}

describe("envio supervisor", () => {
  test("respawns without resetting after a healthy run crashes", async () => {
    const { options, spawnedArgs, exits } = harness([
      { code: 1, runtimeMs: 5 * 60_000 },
      { code: 1, runtimeMs: 5 * 60_000 },
      { signal: "SIGTERM", runtimeMs: 5 * 60_000 },
    ]);

    await expect(
      superviseEnvio([], railwayEnv, { ...options, maxRespawns: 2 }),
    ).resolves.toBeUndefined();

    expect(spawnedArgs).toEqual([["start"], ["start"], ["start"]]);
    expect(exits).toEqual([]);
  });

  test("refunds the respawn budget after each healthy run", async () => {
    const runs: ScriptedRun[] = Array.from({ length: 12 }, () => ({
      code: 1,
      runtimeMs: 5 * 60_000,
    }));
    runs.push({ signal: "SIGTERM", runtimeMs: 5 * 60_000 });
    const { options, spawnedArgs } = harness(runs);

    await expect(
      superviseEnvio([], railwayEnv, { ...options, maxRespawns: 2 }),
    ).resolves.toBeUndefined();

    // Every crash clears MIN_HEALTHY_RUNTIME_MS, so the two-respawn budget is
    // refunded each time and never runs out over 12 successive crashes.
    expect(spawnedArgs.length).toBe(13);
  });

  test("resumes after a startup crash", async () => {
    const { options, spawnedArgs } = harness([
      { code: 1, runtimeMs: 500 },
      { code: 1, runtimeMs: 500 },
      { code: 1, runtimeMs: 500 },
    ]);

    await expect(superviseEnvio([], railwayEnv, { ...options, maxRespawns: 2 })).rejects.toThrow(
      "exit 1",
    );

    expect(spawnedArgs).toEqual([["start"], ["start"], ["start"]]);
  });

  test("gives up to Railway once the respawn budget is exhausted", async () => {
    const runs = Array.from({ length: 5 }, () => ({ code: 1, runtimeMs: 500 }));
    const { options, spawnedArgs, exits, logged } = harness(runs);

    await expect(superviseEnvio([], railwayEnv, { ...options, maxRespawns: 2 })).rejects.toThrow(
      "exit 1",
    );

    expect(spawnedArgs.length).toBe(3);
    expect(exits).toEqual([1]);
    expect(logged.some((message) => message.includes("giving up so Railway can restart"))).toBe(
      true,
    );
  });

  test("exits when Postgres never comes back", async () => {
    const { options, spawnedArgs, exits, logged } = harness(
      [{ code: 1, runtimeMs: 5 * 60_000 }, { code: 1 }],
      [false],
    );

    await expect(superviseEnvio([], railwayEnv, options)).rejects.toThrow("exit 1");

    expect(spawnedArgs.length).toBe(1);
    expect(exits).toEqual([1]);
    expect(logged.some((message) => message.includes("did not become reachable"))).toBe(true);
  });

  test("does not respawn when Envio is terminated by a signal", async () => {
    const { options, spawnedArgs, exits } = harness([{ signal: "SIGTERM", runtimeMs: 60_000 }]);

    await expect(superviseEnvio([], railwayEnv, options)).resolves.toBeUndefined();

    expect(spawnedArgs.length).toBe(1);
    expect(exits).toEqual([]);
  });

  test("logs and exits when envio cannot be spawned at all", async () => {
    const { options, exits, logged } = harness([
      { error: Object.assign(new Error("spawn envio ENOENT"), { code: "ENOENT" }) },
    ]);

    await expect(superviseEnvio([], railwayEnv, options)).rejects.toThrow("exit 1");

    expect(exits).toEqual([1]);
    expect(logged[0]).toContain("envio binary was not found in PATH");
  });

  test("exits cleanly when Envio finishes successfully", async () => {
    const { options, exits } = harness([{ code: 0, runtimeMs: 60_000 }]);

    await expect(superviseEnvio([], railwayEnv, options)).rejects.toThrow("exit 0");

    expect(exits).toEqual([0]);
  });
});

describe("postgres readiness probe", () => {
  test("returns once the database accepts a connection", async () => {
    const attempts: number[] = [];
    let clock = 0;

    const reachable = await waitForDatabase(railwayEnv, {
      probe: async () => {
        attempts.push(clock);
        return attempts.length === 3;
      },
      sleep: async (ms) => {
        clock += ms;
      },
      now: () => clock,
      logInfo: () => {},
      intervalMs: 2_000,
      timeoutMs: 60_000,
    });

    expect(reachable).toBe(true);
    expect(attempts).toEqual([0, 2_000, 4_000]);
  });

  test("gives up after the wait window elapses", async () => {
    let clock = 0;

    const reachable = await waitForDatabase(railwayEnv, {
      probe: async () => false,
      sleep: async (ms) => {
        clock += ms;
      },
      now: () => clock,
      logInfo: () => {},
      intervalMs: 2_000,
      timeoutMs: 10_000,
    });

    expect(reachable).toBe(false);
    expect(clock).toBeGreaterThanOrEqual(10_000);
  });

  test("does not block when the Postgres address is unusable", async () => {
    const reachable = await waitForDatabase(
      { ...railwayEnv, ENVIO_PG_HOST: "  " },
      {
        probe: async () => {
          throw new Error("probe must not run");
        },
        logInfo: () => {},
      },
    );

    expect(reachable).toBe(false);
  });
});

test.each([
  ["Nothing", 0],
  ["Initialized", 0],
  ["lowercase-address", 0],
  ["changed-config", 78],
  ["changed-address", 78],
  ["Stranded", 78],
  ["Diverged", 78],
  ["Outdated", 78],
  ["holding-null", 1],
  ["stored-null", 1],
  ["stored-malformed", 1],
  ["transient", 1],
  ["close-error", 1],
  ["version-mismatch", 1],
])("read-only storage preflight preserves launch dotenv and classifies %s", (scenario, status) => {
  const directory = mkdtempSync(join(tmpdir(), "metrics-storage-env-"));
  try {
    const launch = join(directory, "launch");
    const project = join(directory, "project");
    mkdirSync(launch);
    mkdirSync(project);
    writeFileSync(join(launch, ".env"), "ENVIO_PG_SCHEMA=launch_schema\n");
    writeFileSync(join(project, ".env"), "ENVIO_PG_SCHEMA=project_schema\n");
    writeFileSync(join(project, "schema.graphql"), "type Transfer { id: ID! }\n");
    writeFileSync(join(project, "handler.js"), "export {};\n");
    writeFileSync(
      join(project, "config.yaml"),
      `${scenario === "lowercase-address" ? "address_format: lowercase\n" : ""}name: storage-env-fixture
contracts:
  - name: Example
    handler: ./handler.js
    events:
      - event: Transfer(address indexed from, address indexed to, uint256 value)
chains:
  - id: 1
    start_block: 0
    contracts:
      - name: Example
        address: "${scenario === "lowercase-address" ? "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" : "0x0000000000000000000000000000000000000001"}"
`,
    );
    const envioRoot = dirname(createRequire(import.meta.url).resolve("envio/package.json"));
    const nativeUrl = (name: string) =>
      pathToFileURL(join(envioRoot, "src", `${name}.res.mjs`)).href;
    const trace = join(directory, "storage.json");
    // Execute native CLI/config/storage/plan/address comparison; replace only database I/O.
    const storage = `import { writeFileSync } from "node:fs";
import { Db } from ${JSON.stringify(nativeUrl("Env"))};
import * as Config from ${JSON.stringify(nativeUrl("Config"))};
import * as ChainMap from ${JSON.stringify(nativeUrl("ChainMap"))};
import * as ContractMapping from ${JSON.stringify(nativeUrl("ContractMapping"))};
const scenario = ${JSON.stringify(scenario)};
const calls = [];
export const read = (_client, rows) => { calls.push("read"); return rows; };
export function make(options) {
  calls.push("create");
  const config = Config.load();
  const chains = ChainMap.values(config.chainMap);
  const client = {
    layouts: () => ({ entities: [], rawEvents: [], effectCache: [] }),
    holding: async () => {
      if (scenario === "transient") throw Error("fixture-sensitive-storage-error");
      if (scenario === "holding-null") return null;
      return ["Nothing", "Stranded", "Diverged", "Outdated"].includes(scenario) ? scenario : "Initialized";
    },
    readStoredConfig: async () => scenario === "stored-null" ? null : ({
      envioInfo: scenario === "stored-malformed" ? "fixture-sensitive-invalid-json" : JSON.stringify(scenario === "changed-config" ? { ...config.envioInfo, version: "older" } : config.envioInfo),
      contractNames: ContractMapping.names(config.contractMapping),
      chains,
    }),
    resume: async () => ({
      chains: chains.map((chain) => ({ ...chain, checkpointId: 0 })),
      addresses: [{ chainId: 1, address: Buffer.from(scenario === "lowercase-address" ? "abcdefabcdefabcdefabcdefabcdefabcdefabcd" : "0000000000000000000000000000000000000001", "hex"), contractId: 0, registrationBlock: -1 }]
        .filter(() => scenario !== "changed-address"),
      caches: [], reorgCheckpoints: [],
    }),
    close: async () => {
      writeFileSync(${JSON.stringify(trace)}, JSON.stringify({ schema: Db.publicSchema, pgSchema: options.postgres.pgSchema, closed: true, calls }));
      if (scenario === "close-error") throw Error("fixture-sensitive-close-error");
    },
  };
  return new Proxy(client, { get(target, key) {
    if (!(key in target)) throw Error("Forbidden storage operation: " + String(key));
    return (...args) => { calls.push(key); return target[key](...args); };
  }});
}`;
    const preload = `import { registerHooks, syncBuiltinESMExports } from "node:module";
import fs from "node:fs";
if (${JSON.stringify(scenario)} === "version-mismatch") {
  const read = fs.readFileSync;
  fs.readFileSync = (file, ...args) => String(file) === ${JSON.stringify(join(envioRoot, "package.json"))}
    ? JSON.stringify({ ...JSON.parse(read(file, "utf8")), version: "3.18.0" })
    : read(file, ...args);
  syncBuiltinESMExports();
}
registerHooks({ load(url, context, nextLoad) {
  return url === ${JSON.stringify(pathToFileURL(join(envioRoot, "src/bindings/StorageClient.res.mjs")).href)}
    ? { format: "module", shortCircuit: true, source: ${JSON.stringify(storage)} }
    : nextLoad(url, context);
}});`;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(preload)}`,
        fileURLToPath(new URL("../src/check-envio-storage.mjs", import.meta.url)),
        "start",
        "--directory",
        project,
      ],
      {
        cwd: launch,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "development",
          LOG_STRATEGY: "ecs-console",
          LOG_LEVEL: "silent",
          ENVIO_API_TOKEN: "fixture-only",
        },
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(result.status, result.stderr).toBe(status);
    expect(result.stdout + result.stderr).not.toContain("fixture-sensitive");
    if (scenario === "version-mismatch") {
      expect(existsSync(trace)).toBe(false);
      return;
    }
    const receipt = JSON.parse(readFileSync(trace, "utf8"));
    expect(receipt).toMatchObject({
      schema: "launch_schema",
      pgSchema: "launch_schema",
      closed: true,
    });
    expect(
      receipt.calls.every((call: string) =>
        ["create", "layouts", "holding", "readStoredConfig", "resume", "read", "close"].includes(
          call,
        ),
      ),
    ).toBe(true);
    expect(receipt.calls).toContain("close");
    if (
      ["Initialized", "lowercase-address", "changed-address", "close-error"].includes(
        String(scenario),
      )
    ) {
      expect(receipt.calls).toContain("resume");
      expect(receipt.calls).toContain("read");
    } else {
      expect(receipt.calls).not.toContain("resume");
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
