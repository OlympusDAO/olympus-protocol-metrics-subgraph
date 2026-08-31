import { describe, expect, test } from "vitest";

import {
  type EnvioSupervisorOptions,
  formatEnvioSpawnError,
  isRailwayRuntime,
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
    expect(isRailwayRuntime(validEnv)).toBe(false);
    expect(resolveEnvioArgs([], validEnv)).toEqual(["start"]);
    expect(resolveEnvioArgs(["start"], validEnv)).toEqual(["start"]);
    expect(resolveEnvioArgs(["dev"], validEnv)).toEqual(["dev"]);
  });

  test("resets Envio only for Railway start commands", () => {
    const railwayEnv = {
      ...validEnv,
      ENVIO_INDEXER_PORT: "9898",
      ENVIO_PG_SCHEMA: "",
      PORT: "9898",
      RAILWAY_SERVICE_ID: "railway-service-1",
    };

    expect(isRailwayRuntime(railwayEnv)).toBe(true);
    expect(resolveEnvioArgs([], railwayEnv)).toEqual(["start", "-r"]);
    expect(resolveEnvioArgs(["start"], railwayEnv)).toEqual(["start", "-r"]);
    expect(resolveEnvioArgs(["start", "-r"], railwayEnv)).toEqual(["start", "-r"]);
    expect(resolveEnvioArgs(["start", "--reset"], railwayEnv)).toEqual(["start", "--reset"]);
    expect(resolveEnvioArgs(["dev"], railwayEnv)).toEqual(["dev"]);
  });

  test("formats spawn failures loudly before Envio starts", () => {
    expect(
      formatEnvioSpawnError(Object.assign(new Error("spawn envio ENOENT"), { code: "ENOENT" })),
    ).toContain("envio binary was not found in PATH");
    expect(
      formatEnvioSpawnError(Object.assign(new Error("permission denied"), { code: "EACCES" })),
    ).toBe("Failed to start envio: EACCES: permission denied");
  });

  test("resumes instead of resetting when respawning after a crash", () => {
    const railwayEnv = {
      ...validEnv,
      ENVIO_INDEXER_PORT: "9898",
      ENVIO_PG_SCHEMA: "",
      PORT: "9898",
      RAILWAY_SERVICE_ID: "railway-service-1",
    };

    expect(resolveEnvioArgs([], railwayEnv, { respawn: true })).toEqual(["start"]);
    expect(resolveEnvioArgs(["start"], railwayEnv, { respawn: true })).toEqual(["start"]);
    expect(resolveEnvioArgs(["start", "-r"], railwayEnv, { respawn: true })).toEqual(["start"]);
    expect(resolveEnvioArgs(["start", "--reset"], railwayEnv, { respawn: true })).toEqual([
      "start",
    ]);
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

    // First boot resets, every respawn resumes.
    expect(spawnedArgs).toEqual([["start", "-r"], ["start"], ["start"]]);
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

  test("repeats the reset when the crash happened before a healthy run", async () => {
    const { options, spawnedArgs } = harness([
      { code: 1, runtimeMs: 500 },
      { code: 1, runtimeMs: 500 },
      { code: 1, runtimeMs: 500 },
    ]);

    await expect(superviseEnvio([], railwayEnv, { ...options, maxRespawns: 2 })).rejects.toThrow(
      "exit 1",
    );

    // A crash during startup may have left a half-created schema, so the reset
    // is repeated rather than resumed.
    expect(spawnedArgs).toEqual([
      ["start", "-r"],
      ["start", "-r"],
      ["start", "-r"],
    ]);
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
