import { type Address, indexer, type KodiakPool } from "envio";
import { getAddress } from "viem";

import { resolveKodiakUnderlyingPool } from "../effects";
import { KODIAK_ABI } from "../snapshot/abis/kodiak";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { getClient, readInvariantContract } from "../snapshot/contracts";
import { addr } from "../snapshot/math";
import { buildLpTransferWhere, handleLpTransfer } from "./Erc20Transfers";

// Treasury balance + totalSupply tracking — identical to the LpERC20 handler.
// Plus a side-effect: ensure the KodiakPool mapping entity exists so pricing
// can look up the underlying UniV3 pool without RPC.
indexer.onEvent(
  {
    contract: "KodiakLp",
    event: "Transfer",
    where: buildLpTransferWhere,
  },
  async ({ event, context }) => {
    await handleLpTransfer({ event, context });

    const kodiakLp = addr(event.srcAddress);
    const id = `${event.chainId}-${kodiakLp}`;
    const existing = await context.KodiakPool.get(id);
    if (existing) return;

    const underlyingPool = await context.effect(resolveKodiakUnderlyingPool, {
      chainId: event.chainId,
      kodiakLp,
    });

    context.KodiakPool.set({
      id,
      chainId: event.chainId,
      kodiakLpAddress: kodiakLp,
      underlyingPoolAddress: addr(underlyingPool),
      updatedAtBlock: BigInt(event.block.number),
    } satisfies KodiakPool);
  },
);

// Dynamically register the underlying UniV3 pool the first time we see a
// Kodiak LP event. The contractRegister context exposes only `chain` and
// `log` (no `effect`), so we resolve the underlying pool via
// `readInvariantContract`, whose process-wide cache means at most one RPC per
// Kodiak LP per indexer process. Subsequent invocations hit the cache.
// Envio dedupes `.add(addr)` calls so it's safe to call on every event.
indexer.contractRegister(
  {
    contract: "KodiakLp",
    event: "Transfer",
  },
  async ({ event, context }) => {
    const config = CHAIN_CONFIGS[event.chainId as 42161 | 80094];
    if (!config) return;
    const client = getClient(config);
    const underlying = await readInvariantContract(
      client,
      getAddress(event.srcAddress),
      KODIAK_ABI,
      "pool",
      [],
      BigInt(event.block.number),
    );
    context.chain.UniswapV3Pool.add(addr(underlying) as Address);
  },
);
