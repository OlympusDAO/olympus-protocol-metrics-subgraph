import { describe, expect, test, vi } from "vitest";
import {
  buildTreasuryTransferWhere,
  handleTreasuryTransfer,
} from "../../src/handlers/Erc20Transfers";
import { CHAIN_CONFIGS } from "../../src/snapshot/chains";
import { ROBINHOOD } from "../../src/snapshot/chains/robinhood";

const WALLET = "0x317e0f5ef883db95f8ffb5b995b8457903873608";
const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const RUSDG = "0xf04c58853d54f2445989108c29087f1a61c034cb";

describe("Robinhood treasury ingestion registration", () => {
  test("the actual Safe is selected by the production transfer filter", () => {
    expect(CHAIN_CONFIGS[4663]).toBe(ROBINHOOD);
    expect(buildTreasuryTransferWhere({ chain: { id: 4663 } })).toEqual({
      params: [{ from: [WALLET] }, { to: [WALLET] }],
    });
    expect(ROBINHOOD.tokens.find((token) => token.address === USDG)).toMatchObject({
      decimals: 6,
      category: "Stable",
      isLiquid: true,
    });
    expect(ROBINHOOD.tokens.find((token) => token.address === RUSDG)).toMatchObject({
      decimals: 18,
      isLiquid: false,
    });
    expect(ROBINHOOD.liquidityHandlers).toContainEqual({
      kind: "stable",
      id: "usdg-nominal-usd",
      tokens: [USDG],
    });
    expect(ROBINHOOD.mellowVault).toMatchObject({ shares: RUSDG, asset: USDG });
  });
  test.each([
    USDG,
    RUSDG,
  ])("treasury transfer handler records %s for the Safe once", async (token) => {
    const context = {
      TokenBalance: { get: vi.fn(async () => undefined), set: vi.fn() },
      TokenBalanceUpdate: { set: vi.fn() },
    };
    await handleTreasuryTransfer({
      event: {
        chainId: 4663,
        srcAddress: token,
        logIndex: 26,
        block: { number: 65047107, timestamp: 1789615919 },
        params: {
          from: "0x0000000000000000000000000000000000000000",
          to: WALLET,
          value: 499977966094n,
        },
      },
      context,
    });
    expect(context.TokenBalance.set).toHaveBeenCalledTimes(1);
    expect(context.TokenBalance.set).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 4663,
        tokenAddress: token,
        walletAddress: WALLET,
        balance: 499977966094n,
      }),
    );
    expect(context.TokenBalanceUpdate.set).toHaveBeenCalledTimes(1);
  });
});
