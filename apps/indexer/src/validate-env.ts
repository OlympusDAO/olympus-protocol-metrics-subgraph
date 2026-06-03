const REQUIRED_ENV_VARS = [
  "ENVIO_API_TOKEN",
  "ENVIO_PG_HOST",
  "ENVIO_PG_PORT",
  "ENVIO_PG_USER",
  "ENVIO_PG_PASSWORD",
  "ENVIO_PG_DATABASE",
  "ENVIO_PG_SCHEMA",
  "ENVIO_PG_SSL_MODE",
  "HASURA_GRAPHQL_ENDPOINT",
  "HASURA_GRAPHQL_ADMIN_SECRET",
  "ENVIO_ARBITRUM_RPC_URL",
  "ENVIO_BERACHAIN_RPC_URL",
  "ENVIO_BASE_RPC_URL",
  "ENVIO_POLYGON_RPC_URL",
  "ENVIO_FANTOM_RPC_URL",
  "ENVIO_ETHEREUM_RPC_URL",
] as const;

const URL_ENV_VARS = [
  "HASURA_GRAPHQL_ENDPOINT",
  "ENVIO_ARBITRUM_RPC_URL",
  "ENVIO_BERACHAIN_RPC_URL",
  "ENVIO_BASE_RPC_URL",
  "ENVIO_POLYGON_RPC_URL",
  "ENVIO_FANTOM_RPC_URL",
  "ENVIO_ETHEREUM_RPC_URL",
] as const;

const POSITIVE_INTEGER_ENV_VARS = ["ENVIO_PG_PORT"] as const;
const OPTIONAL_POSITIVE_INTEGER_ENV_VARS = ["ENVIO_INDEXER_PORT", "PORT"] as const;

export function validateIndexerEnv(env: NodeJS.ProcessEnv): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => isBlank(env[name]));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const invalidUrls = URL_ENV_VARS.filter((name) => !isUrl(env[name] ?? ""));
  if (invalidUrls.length > 0) {
    throw new Error(`Invalid URL environment variables: ${invalidUrls.join(", ")}`);
  }

  const invalidIntegers = POSITIVE_INTEGER_ENV_VARS.filter((name) => !isPositiveInteger(env[name] ?? ""));
  if (invalidIntegers.length > 0) {
    throw new Error(`Invalid positive integer environment variables: ${invalidIntegers.join(", ")}`);
  }

  const invalidOptionalIntegers = OPTIONAL_POSITIVE_INTEGER_ENV_VARS.filter(
    (name) => !isBlank(env[name]) && !isPositiveInteger(env[name] ?? ""),
  );
  if (invalidOptionalIntegers.length > 0) {
    throw new Error(`Invalid positive integer environment variables: ${invalidOptionalIntegers.join(", ")}`);
  }

  if (!isBlank(env.RAILWAY_DEPLOYMENT_ID) && env.ENVIO_PG_SCHEMA !== env.RAILWAY_DEPLOYMENT_ID) {
    throw new Error("ENVIO_PG_SCHEMA must match RAILWAY_DEPLOYMENT_ID when running on Railway.");
  }

  if (!isBlank(env.RAILWAY_DEPLOYMENT_ID) && isBlank(env.PORT)) {
    throw new Error("PORT must be set when running on Railway.");
  }

  if (!isBlank(env.PORT) && !isBlank(env.ENVIO_INDEXER_PORT) && env.PORT !== env.ENVIO_INDEXER_PORT) {
    throw new Error("ENVIO_INDEXER_PORT must match PORT when PORT is set.");
  }
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPositiveInteger(value: string): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateIndexerEnv(process.env);
}
