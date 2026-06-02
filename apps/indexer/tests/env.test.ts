import { describe, expect, test } from "vitest";

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
        ENVIO_PG_PORT: "0",
      }),
    ).toThrow("Invalid positive integer environment variables: ENVIO_PG_PORT");
  });
});
