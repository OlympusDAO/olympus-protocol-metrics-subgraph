import { createTestIndexer } from "envio";
import { describe, expect, it } from "vitest";

import "../../src/handlers/Erc20Transfers";

const hasApiToken = Boolean(process.env.ENVIO_API_TOKEN);
const FUNDING_BLOCK = 65_047_107;
const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
// Registered in ROBINHOOD.protocolAddresses; Erc20Transfers uses it in both
// buildTreasuryTransferWhere and handleTreasuryTransfer (see offline registration test).
const WALLET = "0x317e0f5ef883db95f8ffb5b995b8457903873608";
const RAW_USDG = 499_977_966_094n;

// This is intentionally a narrow authenticated HyperSync proof. The archive
// baseline replay is covered separately by scripts/verify-robinhood-mellow.ts;
// here we prove Envio delivers the actual post-baseline funding event into the
// production TreasuryERC20 handler without a local RPC fallback.
describe.skipIf(!hasApiToken)("Robinhood USDG funding — live HyperSync", () => {
  it("indexes the funding block as one treasury USDG balance update", async () => {
    const indexer = createTestIndexer();
    const result = await indexer.process({
      chains: {
        4663: { startBlock: FUNDING_BLOCK, endBlock: FUNDING_BLOCK },
      },
    });

    const updates = result.changes.flatMap((change) =>
      ((change.TokenBalanceUpdate?.sets ?? []) as unknown as Array<Record<string, unknown>>).filter(
        (row) =>
          row.chainId === 4663 &&
          row.tokenAddress === USDG &&
          row.walletAddress === WALLET &&
          row.delta === RAW_USDG,
      ),
    );

    expect(updates).toHaveLength(1);
  }, 120_000);
});
