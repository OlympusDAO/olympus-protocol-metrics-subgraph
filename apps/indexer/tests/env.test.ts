import { describe, expect, test } from "vitest";

import { prepareIndexerEnv, resolveEnvioArgs } from "../src/start-envio";
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

  test("requires Railway indexer schemas to match the deployment id", () => {
    expect(() =>
      validateIndexerEnv({
        ...validEnv,
        ENVIO_INDEXER_PORT: "9898",
        ENVIO_PG_SCHEMA: "railway-deployment-1",
        PORT: "9898",
        RAILWAY_DEPLOYMENT_ID: "railway-deployment-1",
      }),
    ).not.toThrow();

    expect(() =>
      validateIndexerEnv({
        ...validEnv,
        ENVIO_PG_SCHEMA: "public",
        RAILWAY_DEPLOYMENT_ID: "railway-deployment-1",
      }),
    ).toThrow("ENVIO_PG_SCHEMA must match RAILWAY_DEPLOYMENT_ID");
  });

  test("injects the Railway deployment id as the schema before validation", () => {
    const env = prepareIndexerEnv({
      ...validEnv,
      ENVIO_INDEXER_PORT: "9898",
      ENVIO_PG_SCHEMA: "",
      PORT: "9898",
      RAILWAY_DEPLOYMENT_ID: "railway-deployment-1",
    });

    expect(env.ENVIO_PG_SCHEMA).toBe("railway-deployment-1");
    expect(() => validateIndexerEnv(env)).not.toThrow();
  });

  test("maps Railway PORT to Envio's indexer healthcheck port", () => {
    const env = prepareIndexerEnv({
      ...validEnv,
      ENVIO_INDEXER_PORT: "",
      ENVIO_PG_SCHEMA: "railway-deployment-1",
      PORT: "9898",
      RAILWAY_DEPLOYMENT_ID: "railway-deployment-1",
    });

    expect(env.ENVIO_INDEXER_PORT).toBe("9898");
    expect(() => validateIndexerEnv(env)).not.toThrow();

    expect(() =>
      validateIndexerEnv({
        ...validEnv,
        ENVIO_PG_SCHEMA: "railway-deployment-1",
        PORT: "",
        RAILWAY_DEPLOYMENT_ID: "railway-deployment-1",
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

  test("defaults startup to envio start when no args are provided", () => {
    expect(resolveEnvioArgs([])).toEqual(["start"]);
    expect(resolveEnvioArgs(["dev"])).toEqual(["dev"]);
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
