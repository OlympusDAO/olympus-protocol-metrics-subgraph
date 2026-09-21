import { addr, token } from "../math";
import type { ChainConfig } from "../types";
import { rpcUrls } from "./rpc";

export const ROBINHOOD_START_BLOCK = 65_044_796;
const TREASURY_MS = addr("0x317e0F5EF883DB95f8fFB5B995b8457903873608");
const ERC20_USDG = addr("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const ERC20_RUSDG = addr("0xf04c58853D54f2445989108C29087F1A61C034cB");

export const ROBINHOOD: ChainConfig = {
  chainId: 4663,
  blockchain: "Robinhood",
  startBlock: ROBINHOOD_START_BLOCK,
  rpcUrls: rpcUrls("ROBINHOOD", "https://rpc.mainnet.chain.robinhood.com"),
  // No OHM deployment/supply attribution in this integration.
  ohmToken: "",
  // Shared by TreasuryERC20's from/to filter and snapshot wallet enumeration.
  // The Safe therefore tracks idle USDG before any Mellow deposit as well.
  protocolAddresses: [TREASURY_MS],
  circulatingSupplyWallets: [],
  treasuryBlacklist: {},
  basePriceFeeds: {},
  names: {
    [TREASURY_MS]: "Treasury MS (Robinhood)",
    [ERC20_USDG]: "USDG",
    [ERC20_RUSDG]: "Mellow USDG Yield Vault (rUSDG)",
  },
  abbreviations: {},
  // USDG is the deposit asset; rUSDG is the non-ERC4626 receipt. Registration
  // is independent of config.yaml, which only selects ingested event sources.
  tokens: [
    token({
      address: ERC20_USDG,
      category: "Stable",
      decimals: 6,
      isLiquid: true,
      isBluechip: false,
      startBlock: ROBINHOOD_START_BLOCK,
      nonStandardBalance: true,
    }),
    token({
      address: ERC20_RUSDG,
      category: "Stable",
      decimals: 18,
      isLiquid: false,
      isBluechip: false,
      startBlock: ROBINHOOD_START_BLOCK,
    }),
  ],
  // Explicit nominal USDG peg, consistent with existing stable handlers.
  // This is not an executable market quote or an assertion of redeemability.
  liquidityHandlers: [{ kind: "stable", id: "usdg-nominal-usd", tokens: [ERC20_USDG] }],
  ownedLiquidityHandlers: [],
  // rUSDG valuation: pushTokenBalanceRecords routes this token to MellowVault.
  // USDG/share = 10^30 / priceD18; multiply by the USDG handler's price. Locked
  // requests use NAV until ReportHandled fixes an asset claim. Never peg rUSDG.
  mellowVault: {
    shares: ERC20_RUSDG,
    asset: ERC20_USDG,
    oracle: addr("0x4336739985da716436460f8E644c03120d334521"),
    redeemQueue: addr("0x873ff30c29450bf4bEB3AfBBB0372a4b47b4969C"),
    startBlock: ROBINHOOD_START_BLOCK,
  },
};
