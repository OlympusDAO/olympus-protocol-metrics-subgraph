// Configuration for the pinned eRPC 0.5.0-pv1 build and embedded JS loader.
const chainIds = [1, 137, 250, 8453, 42161, 80094, 4663];
const required = (name, pattern) => {
  const value = process.env[name]?.trim();
  if (!value || !pattern.test(value)) {
    throw new Error(`Missing or invalid ${name}`);
  }
  return value;
};
const database = required("RPC_CACHE_DATABASE_URL", /^postgres(ql)?:\/\//);
// biome-ignore lint/suspicious/noUndeclaredEnvVars: eRPC reads runtime settings outside Turbo.
const maxRps = Number(process.env.RPC_CACHE_MAX_RPS || "100");
if (!Number.isSafeInteger(maxRps) || maxRps < 1) {
  throw new Error("RPC_CACHE_MAX_RPS must be a positive integer");
}
const upstreams = chainIds.map((chainId) => ({
  id: `archive-${chainId}`,
  type: "evm",
  endpoint: required(`UPSTREAM_RPC_URL_${chainId}`, /^https?:\/\/[^\s]+$/),
  evm: { chainId, statePollerInterval: "30s" },
  rateLimitBudget: "archive",
  rateLimitAutoTune: { enabled: false },
}));

export default {
  // Transport errors can contain full URLs, and provider error bodies can echo
  // credentials. Keep runtime logs off; use private metrics and health checks.
  logLevel: "disabled",
  server: {
    listenV4: false,
    httpHostV4: "0.0.0.0",
    httpPortV4: 4000,
    listenV6: true,
    httpHostV6: "[::]",
    httpPortV6: 4000,
    includeErrorDetails: false,
    executionHeaders: "summary",
  },
  healthCheck: { mode: "simple" },
  metrics: { enabled: true, hostV4: "0.0.0.0", port: 4001 },
  database: {
    evmJsonRpcCache: {
      connectors: [
        {
          id: "historical",
          driver: "postgresql",
          postgresql: {
            connectionUri: database,
            table: "rpc_cache",
            maxConns: 10,
          },
        },
      ],
      policies: [
        // 0.5.0 may infer range finality from an old numeric lower bound when
        // the upper bound is missing/pending/safe. Only concrete ranges qualify.
        {
          network: "*",
          method: "eth_getLogs",
          params: [{ fromBlock: "0x*", toBlock: "0x*" }],
          finality: "finalized",
          empty: "allow",
          connector: "historical",
          ttl: "0s",
        },
        // Only explicit block numbers qualify for methods with a block selector.
        ...[
          ["eth_call", ["*", "0x*"]],
          ["eth_getCode", ["*", "0x*"]],
          ["eth_getBalance", ["*", "0x*"]],
          ["eth_getStorageAt", ["*", "*", "0x*"]],
          ["eth_getTransactionCount", ["*", "0x*"]],
        ].map(([method, params]) => ({
          network: "*",
          method,
          params,
          finality: "finalized",
          empty: "allow",
          connector: "historical",
          ttl: "0s",
        })),
        {
          network: "*",
          method: "eth_getBlockByNumber",
          params: ["0x*"],
          finality: "finalized",
          empty: "ignore",
          connector: "historical",
          ttl: "0s",
        },
        ...[
          "eth_getBlockByHash",
          "eth_getTransactionReceipt",
          "eth_getTransactionByHash",
        ].map((method) => ({
          network: "*",
          method,
          finality: "finalized",
          empty: "ignore",
          connector: "historical",
          ttl: "0s",
        })),
      ],
    },
  },
  rateLimiters: {
    budgets: [
      {
        id: "archive",
        // Request counting partitions wildcard rules by concrete RPC method.
        // Unit credits share one aggregate pool across methods and networks.
        creditUnits: { "*": 1 },
        rules: [
          { method: "*", maxCount: maxRps, period: "1s", countMode: "credit" },
        ],
      },
    ],
  },
  projects: [
    {
      id: "metrics",
      upstreams,
      upstreamDefaults: {
        failsafe: [
          {
            matchMethod: "*",
            timeout: { duration: "20s" },
            retry: { maxAttempts: 1 },
          },
        ],
      },
      networkDefaults: {
        directiveDefaults: {
          skipInterpolation: true,
          retryEmpty: false,
          retryPending: false,
        },
        failsafe: [
          {
            matchMethod: "*",
            timeout: { duration: "45s" },
            retry: {
              maxAttempts: 2,
              delay: "1s",
              backoffMaxDelay: "2s",
              backoffFactor: 2,
            },
          },
        ],
        evm: {
          // 0.5.0 has no switch to disable inferred finality. This sentinel exceeds
          // every practical EVM height, so only the provider's finalized tag can
          // authorize permanent storage. Never replace with a confirmation guess.
          fallbackFinalityDepth: 9007199254740991,
          getLogsSplitOnError: true,
          getLogsSplitConcurrency: 1,
        },
      },
      networks: chainIds.map((chainId) => ({
        architecture: "evm",
        evm: { chainId },
      })),
    },
  ],
};
