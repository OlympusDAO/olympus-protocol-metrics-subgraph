import type { EvmOnBlockContext, TokenBalance, TokenBalanceUpdate } from "envio";
import { indexer } from "envio";

import { readBlockTimestamp, readErc20BalanceOf } from "../effects";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { addr, isActive } from "../snapshot/math";
import type { ChainId } from "../snapshot/types";

// One-shot per-chain backfill of TokenBalance entities at the chain start
// block. For every (token, wallet) pair the chain config covers, we read
// `balanceOf(token, wallet)` once and seed TokenBalance with that value.
// The Transfer handler then accumulates deltas onto a correct starting
// point, so TokenBalance stays in sync with on-chain reality without
// per-snapshot RPC reads.
//
// Why this exists: wallets that held tokens before our indexing window
// (e.g. Cross-Chain Arbitrum held 18,072 FRAX at block 10,950,000) never
// surfaced their funding Transfer in our event stream. Outflows after
// chain start then drove the ledger negative — the classic "Class A
// phantom-negative" bug. Reading balanceOf once at chain start seeds the
// pre-existing position so subsequent Transfer events land on the right
// base. See tasks/pr-311-feedback.md for the full audit.
//
// Block to read at: `startBlock - 1` is the last block we don't index, so
// reading there returns the cumulative state from genesis up to (but not
// including) our window. In practice our startBlocks are chosen at quiet
// points and balanceOf(startBlock) == balanceOf(startBlock - 1) — the
// `-1` choice is correctness insurance against a startBlock that happens
// to contain a Transfer event we also process.
const BACKFILL_CHAINS: { chain: ChainId; startBlock: number }[] = [
  { chain: 1, startBlock: 12_000_000 },
  { chain: 137, startBlock: 23_000_000 },
  { chain: 250, startBlock: 37_320_000 },
  { chain: 8453, startBlock: 13_204_827 },
  { chain: 42161, startBlock: 10_950_000 },
  { chain: 80094, startBlock: 799_194 },
];

const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

export async function runBackfill(
  context: EvmOnBlockContext,
  block: { number: number },
): Promise<{ seeded: number; skipped: number }> {
  const chainId = context.chain.id;
  const entry = BACKFILL_CHAINS.find((value) => value.chain === chainId);
  if (!entry) {
    throw new Error(`BackfillTokenBalances: unsupported chain ${chainId}`);
  }
  if (block.number !== entry.startBlock) {
    throw new Error(
      `BackfillTokenBalances on chain ${chainId} fired at unexpected block ${block.number} (expected ${entry.startBlock})`,
    );
  }
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`BackfillTokenBalances: no chain config for ${chainId}`);
  }

  // Read at startBlock - 1 so we capture the pre-window state. The cached
  // `readErc20BalanceOf` effect dedups identical lookups across re-syncs.
  const readAtBlock = block.number > 0 ? block.number - 1 : block.number;
  const blockNumberBig = BigInt(block.number);
  const readAtBig = BigInt(readAtBlock);
  const blockTimestamp = BigInt(
    await context.effect(readBlockTimestamp, { chainId, blockNumber: block.number }),
  );

  let seeded = 0;
  let skipped = 0;
  for (const tokenDef of config.tokens) {
    if (tokenDef.address === NATIVE_TOKEN) {
      // Native balances live in NativeBalanceState; balanceOf would revert.
      skipped++;
      continue;
    }
    if (!isActive(tokenDef, readAtBig)) {
      // Token not yet deployed at the read block — balanceOf reverts and
      // there's nothing to seed.
      skipped++;
      continue;
    }
    for (const wallet of config.protocolAddresses) {
      const raw = await context.effect(readErc20BalanceOf, {
        chainId,
        tokenAddress: tokenDef.address,
        walletAddress: wallet,
        atBlock: readAtBlock,
      });
      const balance = BigInt(raw);
      if (balance === 0n) {
        skipped++;
        continue;
      }
      const tokenLower = addr(tokenDef.address);
      const walletLower = addr(wallet);
      const id = `${chainId}-${tokenLower}-${walletLower}`;

      const update: TokenBalanceUpdate = {
        id: `${chainId}-${tokenLower}-${walletLower}-backfill`,
        chainId,
        tokenAddress: tokenLower,
        walletAddress: walletLower,
        delta: balance,
        balance,
        block: blockNumberBig,
        timestamp: blockTimestamp,
      };
      context.TokenBalanceUpdate.set(update);

      const entity: TokenBalance = {
        id,
        chainId,
        tokenAddress: tokenLower,
        walletAddress: walletLower,
        balance,
        updatedAtBlock: blockNumberBig,
      };
      context.TokenBalance.set(entity);

      seeded++;
    }
  }

  context.log.info(
    `BackfillTokenBalances chain=${chainId} block=${block.number} seeded=${seeded} skipped=${skipped}`,
  );
  return { seeded, skipped };
}

indexer.onBlock(
  {
    name: "BackfillTokenBalances",
    where: ({ chain }) => {
      const entry = BACKFILL_CHAINS.find((value) => value.chain === chain.id);
      if (!entry) {
        // Unknown chain — never fire. (Throwing in `where` aborts the run,
        // so just return a never-matching filter instead.)
        return { block: { number: { _gte: 0, _lte: 0, _every: Number.MAX_SAFE_INTEGER } } };
      }
      return {
        block: {
          number: { _gte: entry.startBlock, _lte: entry.startBlock },
        },
      };
    },
  },
  async ({ block, context }) => {
    await runBackfill(context, block);
  },
);
