import type { ChainlinkPriceState, ChainlinkPriceUpdate } from "envio";
import { describe, expect, test, vi } from "vitest";

import { applyAnswerUpdated } from "../../src/handlers/ChainlinkAggregator";

const ARBITRUM_CHAIN_ID = 42161;
const ETH_USD_FEED = "0x639fe6ab55c921f74e7fac1ee960c0b6293ba612";
const WETH_ARBITRUM = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
const UNKNOWN_FEED = "0x0000000000000000000000000000000000000123";

function buildContext() {
  const stateSetSpy = vi.fn<(entity: ChainlinkPriceState) => void>();
  const updateSetSpy = vi.fn<(entity: ChainlinkPriceUpdate) => void>();
  const context = {
    ChainlinkPriceState: {
      get: async () => undefined,
      set: stateSetSpy,
    },
    ChainlinkPriceUpdate: {
      set: updateSetSpy,
    },
  };
  return { context, stateSetSpy, updateSetSpy };
}

describe("applyAnswerUpdated", () => {
  test("writes both ChainlinkPriceUpdate (immutable) and ChainlinkPriceState (latest) when matching feed", async () => {
    const { context, stateSetSpy, updateSetSpy } = buildContext();
    await applyAnswerUpdated(
      {
        chainId: ARBITRUM_CHAIN_ID,
        srcAddress: ETH_USD_FEED,
        logIndex: 5,
        block: { number: 12_345, timestamp: 1_700_000_000 },
        params: { current: 200_000_000_000n, roundId: 42n, updatedAt: 1_700_000_000n },
      },
      context,
    );

    // Immutable per-event update.
    expect(updateSetSpy).toHaveBeenCalledTimes(1);
    expect(updateSetSpy).toHaveBeenCalledWith({
      id: `${ARBITRUM_CHAIN_ID}-${ETH_USD_FEED}-12345-5`,
      chainId: ARBITRUM_CHAIN_ID,
      feedAddress: ETH_USD_FEED,
      tokenAddress: WETH_ARBITRUM,
      answer: 200_000_000_000n,
      decimals: 8,
      roundId: 42n,
      block: 12_345n,
      timestamp: 1_700_000_000n,
    });

    // Mutable latest pointer.
    expect(stateSetSpy).toHaveBeenCalledTimes(1);
    expect(stateSetSpy).toHaveBeenCalledWith({
      id: `${ARBITRUM_CHAIN_ID}-${ETH_USD_FEED}`,
      chainId: ARBITRUM_CHAIN_ID,
      feedAddress: ETH_USD_FEED,
      tokenAddress: WETH_ARBITRUM,
      answer: 200_000_000_000n,
      decimals: 8,
      roundId: 42n,
      updatedAtBlock: 12_345n,
      updatedAtTimestamp: 1_700_000_000n,
    });
  });

  test("no-ops when no chainlink handler matches the source feed address", async () => {
    const { context, stateSetSpy, updateSetSpy } = buildContext();
    await applyAnswerUpdated(
      {
        chainId: ARBITRUM_CHAIN_ID,
        srcAddress: UNKNOWN_FEED,
        logIndex: 0,
        block: { number: 12_345, timestamp: 1_700_000_000 },
        params: { current: 200_000_000_000n, roundId: 42n, updatedAt: 1_700_000_000n },
      },
      context,
    );
    expect(stateSetSpy).not.toHaveBeenCalled();
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  test("no-ops when the chain id is not configured", async () => {
    const { context, stateSetSpy, updateSetSpy } = buildContext();
    await applyAnswerUpdated(
      {
        chainId: 999_999,
        srcAddress: ETH_USD_FEED,
        logIndex: 0,
        block: { number: 12_345, timestamp: 1_700_000_000 },
        params: { current: 200_000_000_000n, roundId: 42n, updatedAt: 1_700_000_000n },
      },
      context,
    );
    expect(stateSetSpy).not.toHaveBeenCalled();
    expect(updateSetSpy).not.toHaveBeenCalled();
  });
});
