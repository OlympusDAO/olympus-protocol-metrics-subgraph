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

// Cached effect that reads `principalReceivables()` on a Cooler Loans
// Clearinghouse (V1, V1.1, V2). Returned as a string-stringified uint256 in
// raw 18-decimal DAI units. Reverts (e.g. before clearinghouse deployment)
// surface as `null` so the snapshot path can skip without failing.
const CLEARINGHOUSE_ABI = [
  {
    inputs: [],
    name: "principalReceivables",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const readCoolerPrincipalReceivables = createEffect(
  {
    name: "readCoolerPrincipalReceivables",
    input: { chainId: S.number, clearinghouse: S.string, atBlock: S.number },
    output: S.string,
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId as ChainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    try {
      const value = await retryRpc(() =>
        client.readContract({
          address: getAddress(input.clearinghouse),
          abi: CLEARINGHOUSE_ABI,
          functionName: "principalReceivables",
          blockNumber: BigInt(input.atBlock),
        }),
      );
      return (value as bigint).toString();
    } catch {
      // Effect outputs can't be null with the available schema primitives, so
      // we signal "no value" with an empty string. Consumers check for === "".
      return "";
    }
  },
);

// Cached effect that reads `totalDebt()` on the MonoCooler clearinghouse.
// MonoCooler debt is denominated in USDS but priced via the DAI Chainlink
// rate (legacy quirk — see Phase 1 decision #5 / inventory open question #3).
const MONOCOOLER_ABI = [
  {
    inputs: [],
    name: "totalDebt",
    outputs: [{ internalType: "uint128", name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const readMonoCoolerTotalDebt = createEffect(
  {
    name: "readMonoCoolerTotalDebt",
    input: { chainId: S.number, monoCooler: S.string, atBlock: S.number },
    output: S.string,
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId as ChainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    try {
      const value = await retryRpc(() =>
        client.readContract({
          address: getAddress(input.monoCooler),
          abi: MONOCOOLER_ABI,
          functionName: "totalDebt",
          blockNumber: BigInt(input.atBlock),
        }),
      );
      return (value as bigint).toString();
    } catch {
      return "";
    }
  },
);

// Cached effect that snapshots the Olympus Boosted Liquidity Vault registry:
// iterates `activeVaultCount()` + `activeVaults(i)` and, for each active vault,
// reads `getPoolOhmShare()`. Returns lists of vault addresses + raw OHM shares
// (9-decimal stringified) in matching order. Cached per (registry, atBlock)
// so each snapshot block triggers one RPC roundtrip per vault.
const BLV_REGISTRY_ABI = [
  {
    inputs: [],
    name: "activeVaultCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "activeVaults",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const BLV_VAULT_ABI = [
  {
    inputs: [],
    name: "getPoolOhmShare",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const snapshotBlvRegistry = createEffect(
  {
    name: "snapshotBlvRegistry",
    input: { chainId: S.number, registry: S.string, atBlock: S.number },
    output: S.schema({
      vaults: S.array(S.string),
      ohmShares: S.array(S.string),
    }),
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId as ChainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    const registry = getAddress(input.registry);
    const blockNumber = BigInt(input.atBlock);

    let count: bigint;
    try {
      count = await retryRpc(() =>
        client.readContract({
          address: registry,
          abi: BLV_REGISTRY_ABI,
          functionName: "activeVaultCount",
          blockNumber,
        }),
      );
    } catch {
      return { vaults: [], ohmShares: [] };
    }

    const vaults: string[] = [];
    const ohmShares: string[] = [];
    for (let i = 0n; i < count; i++) {
      try {
        const vault = (await retryRpc(() =>
          client.readContract({
            address: registry,
            abi: BLV_REGISTRY_ABI,
            functionName: "activeVaults",
            args: [i],
            blockNumber,
          }),
        )) as string;
        const share = (await retryRpc(() =>
          client.readContract({
            address: getAddress(vault),
            abi: BLV_VAULT_ABI,
            functionName: "getPoolOhmShare",
            blockNumber,
          }),
        )) as bigint;
        vaults.push(vault.toLowerCase());
        ohmShares.push(share.toString());
      } catch {
        // Per-vault revert (e.g. paused vault) — skip but keep iterating.
      }
    }
    return { vaults, ohmShares };
  },
);

// Cached effect that reads BondManager.isActive() + fixedExpiryTeller() in
// one shot. Returns `{ isActive: false, teller: "" }` on revert. Cached per
// (manager, atBlock) so the snapshot path can call cheaply.
const BOND_MANAGER_ABI = [
  {
    inputs: [],
    name: "isActive",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "fixedExpiryTeller",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const readBondManagerState = createEffect(
  {
    name: "readBondManagerState",
    input: { chainId: S.number, bondManager: S.string, atBlock: S.number },
    output: S.schema({
      isActive: S.boolean,
      teller: S.string,
    }),
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId as ChainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    const bondManager = getAddress(input.bondManager);
    const blockNumber = BigInt(input.atBlock);
    try {
      const isActive = (await retryRpc(() =>
        client.readContract({
          address: bondManager,
          abi: BOND_MANAGER_ABI,
          functionName: "isActive",
          blockNumber,
        }),
      )) as boolean;
      if (!isActive) return { isActive: false, teller: "" };
      const teller = (await retryRpc(() =>
        client.readContract({
          address: bondManager,
          abi: BOND_MANAGER_ABI,
          functionName: "fixedExpiryTeller",
          blockNumber,
        }),
      )) as string;
      return { isActive: true, teller: teller.toLowerCase() };
    } catch {
      return { isActive: false, teller: "" };
    }
  },
);

// Cached effect that reads `convertToAssets(10^decimals)` on an ERC4626 vault.
// Returns the assets-per-share ratio as a stringified bigint in underlying
// units. The vault decimals are passed in so the input scales to "one share".
// Result is cached per (vault, atBlock); reverts surface as "" (skip pricing).
const ERC4626_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "shares", type: "uint256" }],
    name: "convertToAssets",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const readErc4626AssetsPerShare = createEffect(
  {
    name: "readErc4626AssetsPerShare",
    input: {
      chainId: S.number,
      vault: S.string,
      shareDecimals: S.number,
      atBlock: S.number,
    },
    output: S.string,
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId as ChainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    try {
      const oneShare = 10n ** BigInt(input.shareDecimals);
      const assets = (await retryRpc(() =>
        client.readContract({
          address: getAddress(input.vault),
          abi: ERC4626_ABI,
          functionName: "convertToAssets",
          args: [oneShare],
          blockNumber: BigInt(input.atBlock),
        }),
      )) as bigint;
      return assets.toString();
    } catch {
      return "";
    }
  },
);

// Cached effect that reads `circulatingSupply()` on the sOHM V3 contract.
// Result is in OHM raw units (9 decimals). Reverts surface as "".
const SOHM_V3_ABI = [
  {
    inputs: [],
    name: "circulatingSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const readSOhmCirculatingSupply = createEffect(
  {
    name: "readSOhmCirculatingSupply",
    input: { chainId: S.number, sOhm: S.string, atBlock: S.number },
    output: S.string,
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId as ChainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    try {
      const value = (await retryRpc(() =>
        client.readContract({
          address: getAddress(input.sOhm),
          abi: SOHM_V3_ABI,
          functionName: "circulatingSupply",
          blockNumber: BigInt(input.atBlock),
        }),
      )) as bigint;
      return value.toString();
    } catch {
      return "";
    }
  },
);

// Cached effect that snapshots the "next OHM distribution" across the active
// staking contracts at a given block. V1 always tried; V2/V3 only after their
// respective start blocks. Returns the sum as a stringified 9-decimal raw
// OHM amount. Reverts skip the contributing contract — matches legacy
// try_/getOrSet pattern.
const OLYMPUS_STAKING_V1_ABI = [
  {
    inputs: [],
    name: "ohmToDistributeNextEpoch",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const OLYMPUS_STAKING_V2_V3_ABI = [
  {
    inputs: [],
    name: "epoch",
    outputs: [
      { internalType: "uint256", name: "length", type: "uint256" },
      { internalType: "uint256", name: "number", type: "uint256" },
      { internalType: "uint256", name: "endTime", type: "uint256" },
      { internalType: "uint256", name: "distribute", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const readNextOhmDistribution = createEffect(
  {
    name: "readNextOhmDistribution",
    input: {
      chainId: S.number,
      stakingV1: S.string,
      stakingV2: S.string,
      stakingV2StartBlock: S.number,
      stakingV3: S.string,
      stakingV3StartBlock: S.number,
      atBlock: S.number,
    },
    output: S.string,
    rateLimit: { calls: 1_000_000, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId as ChainId];
    if (!config) throw new Error(`Unsupported chain ${input.chainId}`);
    const client = getClient(config);
    const blockNumber = BigInt(input.atBlock);
    let total = 0n;

    try {
      const v1 = (await retryRpc(() =>
        client.readContract({
          address: getAddress(input.stakingV1),
          abi: OLYMPUS_STAKING_V1_ABI,
          functionName: "ohmToDistributeNextEpoch",
          blockNumber,
        }),
      )) as bigint;
      total += v1;
    } catch {
      /* V1 revert — skip; matches legacy try_ behavior */
    }

    if (input.atBlock > input.stakingV2StartBlock) {
      try {
        const v2 = (await retryRpc(() =>
          client.readContract({
            address: getAddress(input.stakingV2),
            abi: OLYMPUS_STAKING_V2_V3_ABI,
            functionName: "epoch",
            blockNumber,
          }),
        )) as readonly [bigint, bigint, bigint, bigint];
        total += v2[3];
      } catch {
        /* V2 revert — skip */
      }
    }

    if (input.atBlock > input.stakingV3StartBlock) {
      try {
        const v3 = (await retryRpc(() =>
          client.readContract({
            address: getAddress(input.stakingV3),
            abi: OLYMPUS_STAKING_V2_V3_ABI,
            functionName: "epoch",
            blockNumber,
          }),
        )) as readonly [bigint, bigint, bigint, bigint];
        total += v3[3];
      } catch {
        /* V3 revert — skip */
      }
    }

    return total.toString();
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
