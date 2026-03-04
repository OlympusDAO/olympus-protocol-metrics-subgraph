import { ponder } from "ponder:registry";
import { handleBlock, type BlockContext } from "./handlers/l2";

// --- Arbitrum: Chainlink NewRound event ---
ponder.on("ChainlinkTriggerArbitrum:NewRound", async ({ event, context }) => {
  const ctx: BlockContext = {
    chainId: 42161,
    blockNumber: event.block.number,
    timestamp: Number(event.block.timestamp),
    client: context.client,
    db: context.db,
  };
  await handleBlock(ctx);
});

// --- Base: Chainlink NewRound event ---
ponder.on("ChainlinkTriggerBase:NewRound", async ({ event, context }) => {
  const ctx: BlockContext = {
    chainId: 8453,
    blockNumber: event.block.number,
    timestamp: Number(event.block.timestamp),
    client: context.client,
    db: context.db,
  };
  await handleBlock(ctx);
});

// --- Berachain: OHM Transfer event ---
ponder.on("OhmTransferBerachain:Transfer", async ({ event, context }) => {
  const ctx: BlockContext = {
    chainId: 80094,
    blockNumber: event.block.number,
    timestamp: Number(event.block.timestamp),
    client: context.client,
    db: context.db,
  };
  await handleBlock(ctx);
});

// --- Berachain: Polling fallback ---
ponder.on("BerachainPolling:block", async ({ event, context }) => {
  const ctx: BlockContext = {
    chainId: 80094,
    blockNumber: event.block.number,
    timestamp: Number(event.block.timestamp),
    client: context.client,
    db: context.db,
  };
  await handleBlock(ctx);
});

// --- Polygon: Polling ---
ponder.on("PolygonPolling:block", async ({ event, context }) => {
  const ctx: BlockContext = {
    chainId: 137,
    blockNumber: event.block.number,
    timestamp: Number(event.block.timestamp),
    client: context.client,
    db: context.db,
  };
  await handleBlock(ctx);
});

// --- Fantom: Polling ---
ponder.on("FantomPolling:block", async ({ event, context }) => {
  const ctx: BlockContext = {
    chainId: 250,
    blockNumber: event.block.number,
    timestamp: Number(event.block.timestamp),
    client: context.client,
    db: context.db,
  };
  await handleBlock(ctx);
});
