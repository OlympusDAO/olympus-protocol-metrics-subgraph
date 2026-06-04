import { describe, expect, test } from "vitest";

import {
  attachEnvioChildHandlers,
  formatEnvioSpawnError,
  isRailwayRuntime,
  prepareIndexerEnv,
  resolveEnvioArgs,
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
    expect(formatEnvioSpawnError(Object.assign(new Error("spawn envio ENOENT"), { code: "ENOENT" }))).toContain(
      "envio binary was not found in PATH",
    );
    expect(formatEnvioSpawnError(Object.assign(new Error("permission denied"), { code: "EACCES" }))).toBe(
      "Failed to start envio: EACCES: permission denied",
    );
  });

  test("attaches a spawn error handler that logs and exits", () => {
    const handlers = new Map<string, (first: unknown, second?: unknown) => void>();
    const child = {
      on: (event: string, handler: (first: unknown, second?: unknown) => void) => {
        handlers.set(event, handler);
        return child;
      },
    };
    const logged: string[] = [];
    const exits: number[] = [];

    attachEnvioChildHandlers(child as Parameters<typeof attachEnvioChildHandlers>[0], {
      logError: (message) => logged.push(message),
      exit: (code) => {
        exits.push(code ?? 0);
        throw new Error(`exit ${code}`);
      },
    });

    expect(handlers.has("error")).toBe(true);
    expect(() => handlers.get("error")?.(Object.assign(new Error("spawn envio ENOENT"), { code: "ENOENT" }))).toThrow(
      "exit 1",
    );
    expect(logged[0]).toContain("envio binary was not found in PATH");
    expect(exits).toEqual([1]);
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
