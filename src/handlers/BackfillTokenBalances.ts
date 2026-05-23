import type { BackfillSentinel, EvmOnBlockContext, TokenBalance, TokenBalanceUpdate } from "envio";
import { indexer } from "envio";

import { readBlockTimestamp, readErc20BalanceOf } from "../effects";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { addr, isActive } from "../snapshot/math";
import type { ChainId } from "../snapshot/types";

// One-shot per-chain backfill of TokenBalance entities. For every (token,
// wallet) pair the chain config covers, we read `balanceOf(token, wallet)`
// at `startBlock - 1` and ADD that pre-window balance to the running
// TokenBalance ledger. The Transfer handler accumulates deltas from
// `startBlock` onward; once the backfill seed is added, the running
// ledger reflects pre-window + in-window state correctly.
//
// Why this exists: wallets that held tokens before our indexing window
// (e.g. Cross-Chain Arbitrum held 18,072 FRAX at block 10,950,000) never
// surfaced their funding Transfer in our event stream. Outflows after
// chain start then drove the ledger negative — the phantom-negative bug.
// Seeding via balanceOf at startBlock - 1 closes the pre-window gap.
//
// Why the handler is gated on a sentinel rather than an exact-block
// filter: an earlier design used `where: { _gte: X, _lte: X }` to fire
// only at the exact configured startBlock. HyperSync only delivers
// blocks containing events for our registered contracts, so the handler
// only ran when startBlock happened to coincide with such an event.
// That was true for Arbitrum (10,950,000) but false for Ethereum,
// Polygon, Fantom, Base, and Berachain — backfill never ran on 5/6
// chains, leaving negative balances on Ethereum/Polygon/Fantom. The
// fix: `_gte: startBlock` (no upper bound), and `BackfillSentinel`
// ensures the body runs exactly once per chain.
//
// Math: the handler may fire many blocks after startBlock. By that
// point, the Transfer handler has applied `current = ∑(in-window deltas)`
// to TokenBalance for each affected (token, wallet). We compute
// `newBalance = current + seed` so the resulting ledger equals
// `pre-window + ∑(in-window deltas)` — the true on-chain balance.
// onBlock fires AFTER all events in the same block, so events at the
// fire block are already included in `current`.
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
  if (block.number < entry.startBlock) {
    throw new Error(
      `BackfillTokenBalances on chain ${chainId} fired before startBlock: ${block.number} < ${entry.startBlock}`,
    );
  }
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`BackfillTokenBalances: no chain config for ${chainId}`);
  }

  // Read at startBlock - 1 (NOT block.number - 1) so the seed represents
  // the pre-window state regardless of how late the handler fires. The
  // cached `readErc20BalanceOf` effect dedups identical lookups.
  const readAtBlock = entry.startBlock > 0 ? entry.startBlock - 1 : entry.startBlock;
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
      const seed = BigInt(raw);
      if (seed === 0n) {
        skipped++;
        continue;
      }
      const tokenLower = addr(tokenDef.address);
      const walletLower = addr(wallet);
      const id = `${chainId}-${tokenLower}-${walletLower}`;

      // Add the pre-window seed onto whatever the running ledger has
      // accumulated so far. When this is the first time we touch the
      // pair, `current` is undefined and the new balance equals the
      // seed alone — same as the old overwrite semantics.
      const current = await context.TokenBalance.get(id);
      const currentBalance = current?.balance ?? 0n;
      const newBalance = currentBalance + seed;

      const update: TokenBalanceUpdate = {
        id: `${chainId}-${tokenLower}-${walletLower}-backfill`,
        chainId,
        tokenAddress: tokenLower,
        walletAddress: walletLower,
        delta: seed,
        balance: newBalance,
        block: blockNumberBig,
        timestamp: blockTimestamp,
      };
      context.TokenBalanceUpdate.set(update);

      const entity: TokenBalance = {
        id,
        chainId,
        tokenAddress: tokenLower,
        walletAddress: walletLower,
        balance: newBalance,
        updatedAtBlock: blockNumberBig,
      };
      context.TokenBalance.set(entity);

      seeded++;
    }
  }

  const sentinel: BackfillSentinel = {
    id: String(chainId),
    chainId,
    seededAtBlock: readAtBig,
    firedAtBlock: blockNumberBig,
    seeded,
    skipped,
  };
  context.BackfillSentinel.set(sentinel);

  context.log.info(
    `BackfillTokenBalances chain=${chainId} firedAtBlock=${block.number} readAtBlock=${readAtBlock} seeded=${seeded} skipped=${skipped}`,
  );
  return { seeded, skipped };
}

indexer.onBlock(
  {
    name: "BackfillTokenBalances",
    where: ({ chain }) => {
      const entry = BACKFILL_CHAINS.find((value) => value.chain === chain.id);
      if (!entry) {
        // Unknown chain — never fire on this chain.
        return false;
      }
      // Wide-open lower bound. Handler body short-circuits via the
      // BackfillSentinel after the first successful run.
      return { block: { number: { _gte: entry.startBlock } } };
    },
  },
  async ({ block, context }) => {
    const sentinel = await context.BackfillSentinel.get(String(context.chain.id));
    if (sentinel) return;
    await runBackfill(context, block);
  },
);
