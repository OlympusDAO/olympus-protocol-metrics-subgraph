import type BigNumber from "bignumber.js";
import type { EvmOnBlockContext, NativeBalanceState } from "envio";
import { getAddress, type PublicClient } from "viem";

import { readErc20BalanceOf } from "../effects";
import { getNativeBalance } from "../snapshot/rpc-client";
import { addr, toDecimal, ZERO } from "../snapshot/math";
import type { LiquidityHandler } from "../snapshot/types";

// Shared balance-read helpers used by the snapshot block handler and the
// per-protocol modules it delegates to. Extracted from BlockHandlers.ts per
// @0xJem on PR #311 (Step 5.3) so per-protocol files don't have to
// re-import private helpers from the orchestrator.

// Reads the cached TokenBalance entity (event-accumulated ledger) and
// returns it as a decimal-normalized BigNumber. Returns ZERO if missing or
// zero.
export async function readTokenBalance(
  context: EvmOnBlockContext,
  chainId: number,
  tokenAddress: string,
  walletAddress: string,
  decimals: number,
): Promise<BigNumber> {
  const id = `${chainId}-${addr(tokenAddress)}-${addr(walletAddress)}`;
  const entity = await context.TokenBalance.get(id);
  if (!entity || entity.balance === 0n) return ZERO;
  return toDecimal(entity.balance, decimals);
}

// Snapshot-time `balanceOf(wallet)` fallback for tokens flagged
// `nonStandardBalance: true` in the config. Goes through the cached
// `readErc20BalanceOf` effect so each (chain, token, wallet, block) is one
// RPC ever, regardless of how many snapshots reference it. See the effect
// definition in `src/effects/index.ts` for the why.
export async function readNonStandardBalance(
  context: EvmOnBlockContext,
  chainId: number,
  tokenAddress: string,
  walletAddress: string,
  decimals: number,
  blockNumber: bigint,
): Promise<BigNumber> {
  const raw = await context.effect(readErc20BalanceOf, {
    chainId,
    tokenAddress,
    walletAddress,
    atBlock: Number(blockNumber),
  });
  const rawBigInt = BigInt(raw);
  if (rawBigInt === 0n) return ZERO;
  return toDecimal(rawBigInt, decimals);
}

// Reads the native-token (ETH/MATIC/FTM/...) balance via RPC and persists
// it to NativeBalanceState. Native balances are read-only via getBalance
// and can't be event-driven, so this is the one path that always hits RPC.
export async function readNativeBalance(
  context: EvmOnBlockContext,
  client: PublicClient,
  chainId: number,
  wallet: string,
  decimals: number,
  blockNumber: bigint,
): Promise<BigNumber> {
  const rawBalance = await getNativeBalance(client, getAddress(wallet), blockNumber);
  context.NativeBalanceState.set({
    id: `${chainId}-${addr(wallet)}`,
    chainId,
    walletAddress: addr(wallet),
    balance: rawBalance,
    updatedAtBlock: blockNumber,
  } satisfies NativeBalanceState);
  return toDecimal(rawBalance, decimals);
}

// Maps a LiquidityHandler to the fungible LP-token address whose balance
// the treasury holds (or null for kinds that don't have a fungible LP —
// UniV3 NFT-based positions, stable / remap synthetic handlers).
export function getLpTokenForHandler(handler: LiquidityHandler): string | null {
  if (handler.kind === "univ2") return addr(handler.id);
  if (handler.kind === "balancer") {
    // Balancer V2 poolId encodes the pool token address in the first 20 bytes.
    return `0x${handler.id.slice(2, 42)}`;
  }
  if (handler.kind === "kodiak") return addr(handler.rewardVault ?? handler.pool);
  // Univ3 LP positions are NFT-based; no fungible LP balance to track.
  // Stable / remap have no LP token.
  return null;
}
