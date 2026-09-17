import { addr, token } from "../math";
import type { ChainConfig } from "../types";
import { rpcUrls } from "./rpc";

export const ROBINHOOD_START_BLOCK = 65_044_796;
const wallet = addr("0x317e0F5EF883DB95f8fFB5B995b8457903873608");
const asset = addr("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const shares = addr("0xf04c58853D54f2445989108C29087F1A61C034cB");

export const ROBINHOOD: ChainConfig = {
  chainId: 4663,
  blockchain: "Robinhood",
  startBlock: ROBINHOOD_START_BLOCK,
  rpcUrls: rpcUrls("ROBINHOOD", "https://rpc.mainnet.chain.robinhood.com"),
  // No OHM deployment/supply attribution in this integration.
  ohmToken: "",
  protocolAddresses: [wallet],
  circulatingSupplyWallets: [],
  treasuryBlacklist: {},
  basePriceFeeds: {},
  names: {
    [wallet]: "Treasury MS (Robinhood)",
    [asset]: "USDG",
    [shares]: "Mellow USDG Yield Vault (rUSDG)",
  },
  abbreviations: {},
  tokens: [
    token({
      address: asset,
      category: "Stable",
      decimals: 6,
      isLiquid: true,
      isBluechip: false,
      startBlock: ROBINHOOD_START_BLOCK,
      nonStandardBalance: true,
    }),
    token({
      address: shares,
      category: "Stable",
      decimals: 18,
      isLiquid: false,
      isBluechip: false,
      startBlock: ROBINHOOD_START_BLOCK,
    }),
  ],
  // Explicit nominal USDG peg, consistent with existing stable handlers.
  // This is not an executable market quote or an assertion of redeemability.
  liquidityHandlers: [{ kind: "stable", id: "usdg-nominal-usd", tokens: [asset] }],
  ownedLiquidityHandlers: [],
  mellowVault: {
    shares,
    asset,
    oracle: addr("0x4336739985da716436460f8E644c03120d334521"),
    depositQueue: addr("0x4Cb16151eB97Ec29D3fDfc79CCe2233500A80389"),
    redeemQueue: addr("0x873ff30c29450bf4bEB3AfBBB0372a4b47b4969C"),
    startBlock: ROBINHOOD_START_BLOCK,
  },
};
