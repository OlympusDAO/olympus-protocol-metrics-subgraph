import { createEffect, S } from "envio";
import { getAddress } from "viem";

import { BALANCER_VAULT_ABI } from "../snapshot/abis/balancer";
import { KODIAK_ABI } from "../snapshot/abis/kodiak";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { getClient, retryRpc } from "../snapshot/contracts";

// Cached effect that reads `vault.getPoolTokens(poolId)` once at the block of
// the first event we observe for a given pool. Used to seed BalancerPoolState
// for pools whose creation predates the indexer's chain start_block. The
// returned `tokens` are lowercased addresses and `balances` are stringified
// bigints (effect outputs don't natively encode bigint).
export const seedBalancerPool = createEffect(
  {
    name: "seedBalancerPool",
    input: {
      chainId: S.number,
      vault: S.string,
      poolId: S.string,
      atBlock: S.number,
    },
    output: S.schema({
      tokens: S.array(S.string),
      balances: S.array(S.string),
    }),
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId as 42161 | 80094];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    const result = await retryRpc(() =>
      client.readContract({
        address: getAddress(input.vault),
        abi: BALANCER_VAULT_ABI,
        functionName: "getPoolTokens",
        args: [input.poolId as `0x${string}`],
        blockNumber: BigInt(input.atBlock),
      }),
    );
    return {
      tokens: result[0].map((value: string) => value.toLowerCase()),
      balances: result[1].map((value: bigint) => value.toString()),
    };
  },
);

// Cached effect that resolves a Kodiak LP wrapper's underlying UniswapV3 pool.
// Invariant across blocks; called once per Kodiak LP per indexer process. The
// returned address feeds both a contractRegister call (so the underlying
// pool's events flow through the Univ3 handler) and a KodiakPool entity write
// (so pricing can look up the mapping later).
export const resolveKodiakUnderlyingPool = createEffect(
  {
    name: "resolveKodiakUnderlyingPool",
    input: { chainId: S.number, kodiakLp: S.string },
    output: S.string,
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId as 42161 | 80094];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    const underlying = await retryRpc(() =>
      client.readContract({
        address: getAddress(input.kodiakLp),
        abi: KODIAK_ABI,
        functionName: "pool",
      }),
    );
    return (underlying as string).toLowerCase();
  },
);
