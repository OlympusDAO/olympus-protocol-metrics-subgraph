import { createEffect, S } from "envio";
import { getAddress } from "viem";

import { BALANCER_VAULT_ABI } from "../snapshot/abis/balancer";
import { KODIAK_ABI } from "../snapshot/abis/kodiak";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { getClient, retryRpc } from "../snapshot/contracts";
import type { ChainId } from "../snapshot/types";

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
    const config = CHAIN_CONFIGS[input.chainId as ChainId];
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

// Cached effect that reads `KEYCODE()` on a Bophades module address. Bophades
// modules expose their 4-byte ASCII keycode (e.g. "TRSRY", "CHREG") via this
// view. The Kernel `ActionExecuted` handler calls this once per
// InstallModule / UpgradeModule action to learn which module slot was
// reassigned, then writes BophadesModule keyed by chainId+keycode. The
// keycode of a given module address is invariant for the module's lifetime,
// so caching is safe.
const BOPHADES_MODULE_ABI = [
  {
    inputs: [],
    name: "KEYCODE",
    outputs: [{ internalType: "bytes5", name: "", type: "bytes5" }],
    stateMutability: "pure",
    type: "function",
  },
] as const;

export const resolveBophadesKeycode = createEffect(
  {
    name: "resolveBophadesKeycode",
    input: { chainId: S.number, moduleAddress: S.string },
    output: S.string,
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId as ChainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    const raw = await retryRpc(() =>
      client.readContract({
        address: getAddress(input.moduleAddress),
        abi: BOPHADES_MODULE_ABI,
        functionName: "KEYCODE",
      }),
    );
    // bytes5 is padded with zero bytes when the keycode is shorter than 5
    // characters; strip those to keep the entity field human-readable.
    return decodeKeycode(raw as `0x${string}`);
  },
);

export function decodeKeycode(raw: `0x${string}`): string {
  const hex = raw.slice(2);
  let out = "";
  for (let i = 0; i < hex.length; i += 2) {
    const byte = Number.parseInt(hex.slice(i, i + 2), 16);
    if (byte === 0) break;
    out += String.fromCharCode(byte);
  }
  return out;
}

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
    const config = CHAIN_CONFIGS[input.chainId as ChainId];
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
