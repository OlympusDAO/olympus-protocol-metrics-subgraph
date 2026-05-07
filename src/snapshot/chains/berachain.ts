import { zeroAddress } from "viem";

import { addr, token } from "../math";
import type { ChainConfig, LiquidityHandler } from "../types";

const ERC20_OHM = addr("0x18878Df23e2a36f81e820e4b47b4A40576D3159C");
const ERC20_IBERA = addr("0x9b6761bf2397Bb5a6624a856cC84A3A14Dcd3fe5");
const ERC20_IBGT = addr("0xac03CABA51e17c86c921E1f6CBFBdC91F8BB2E6b");
const ERC20_LBGT = addr("0xBaadCC2962417C01Af99fb2B7C75706B9bd6Babe");
const ERC20_STARGATE_USDC = addr("0x549943e04f40284185054145c6E4e9568C1D3241");
const ERC20_HONEY = addr("0xFCBD14DC51f0A4d49d5E53C2E0950e0bC26d0Dce");
const ERC20_WBERA = addr("0x6969696969696969696969696969696969696969");
const NATIVE_BERA = zeroAddress.toLowerCase();
const BEX_VAULT = addr("0x4Be03f781C497A489E3cB0287833452cA9B9E80B");
const LP_KODIAK_OHM_HONEY = addr("0x98bDEEde9A45C28d229285d9d6e9139e9F505391");
const LP_BERADROME_KODIAK_OHM_HONEY = addr("0x555BAd9EC18dB19dED0057D2517242399d1c5D87");
const LP_UNISWAP_V3_WBERA_HONEY = addr("0x1127f801cb3ab7bdf8923272949aa7dba94b5805");
const LP_KODIAK_IBERA_WBERA_3000 = addr("0x8dD1C3e5fB96ca0E45Fe3c3CC521Ad44e12F3e47");
const LP_KODIAK_IBERA_WBERA_500 = addr("0xfcb24b3b7e87e3810b150d25d5964c566d9a2b6f");
const LP_KODIAK_IBGT_WBERA = addr("0x12bf773F18cEC56F14e7cb91d82984eF5A3148EE");
const LP_BEX_LBGT_WBERA_ID = "0x705fc16ba5a1eb67051934f2fb17eacae660f6c70002000000000000000000d5";
const BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V1 = addr(
  "0x017B4DD27782E2FE3421e71F33ce54801aF696F8",
);
const BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V2 = addr(
  "0x8e5b2DF607B43C8D0F28035210D4e1aD1E72b8ed",
);
const INFRARED_KODIAK_OHM_HONEY_VAULT = addr("0xa57Cb177Beebc35A1A26A286951a306d9B752524");
const BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT = addr("0x815596fa7c4d983d1ca5304e5b48978424c1b448");

const DAO_MULTISIG = addr("0x91494D1BC2286343D51c55E46AE80C9356D099b5");
const TRSRY = addr("0xb1fA0Ac44d399b778B14af0AAF4bCF8af3437ad1");
const DAO_OPS_MULTISIG = addr("0xe22b2d431838528BcaD52d11C4744EfCdc907a1c");
const THJ_CUSTODIAN = addr("0x082689241b09c600b3eaf3812b1d09791e7ded5a");
const INFRARED_CUSTODIAN = addr("0xb65e74f6b2c0633e30ba1be75db818bb9522a81a");

const PROTOCOL_ADDRESSES = [
  DAO_MULTISIG,
  TRSRY,
  DAO_OPS_MULTISIG,
  THJ_CUSTODIAN,
  INFRARED_CUSTODIAN,
];

const names: Record<string, string> = {
  [BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V1]: "Beradrome Kodiak OHM-HONEY Reward Vault V1",
  [BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V2]: "Beradrome Kodiak OHM-HONEY Reward Vault V2",
  [BEX_VAULT]: "BEX Vault",
  [DAO_MULTISIG]: "DAO MS (Berachain)",
  [DAO_OPS_MULTISIG]: "DAO Operations MS (Berachain)",
  [ERC20_HONEY]: "Honey",
  [ERC20_IBERA]: "Infrared BERA",
  [ERC20_IBGT]: "Infrared BGT",
  [ERC20_LBGT]: "Liquid BGT",
  [ERC20_OHM]: "OHM",
  [ERC20_STARGATE_USDC]: "Bridged USDC (Stargate)",
  [ERC20_WBERA]: "Wrapped BERA",
  [NATIVE_BERA]: "BERA",
  [INFRARED_CUSTODIAN]: "Infrared Custodian",
  [INFRARED_KODIAK_OHM_HONEY_VAULT]: "Infrared Kodiak OHM-HONEY Reward Vault",
  [BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT]: "BeraHub Kodiak OHM-HONEY Reward Vault",
  [LP_KODIAK_OHM_HONEY]: "Kodiak OHM-HONEY LP",
  [LP_BERADROME_KODIAK_OHM_HONEY]: "Beradrome Kodiak OHM-HONEY LP",
  [THJ_CUSTODIAN]: "THJ Custodian",
  [TRSRY]: "TRSRY Module",
};

const kodiak: LiquidityHandler = {
  kind: "kodiak",
  id: LP_KODIAK_OHM_HONEY,
  pool: LP_KODIAK_OHM_HONEY,
  tokens: [ERC20_HONEY, ERC20_OHM],
};

const ownedLiquidityHandlers: LiquidityHandler[] = [
  kodiak,
  {
    kind: "kodiak",
    id: LP_BERADROME_KODIAK_OHM_HONEY,
    pool: LP_KODIAK_OHM_HONEY,
    rewardVault: BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V1,
    tokens: [ERC20_HONEY, ERC20_OHM],
  },
  {
    kind: "kodiak",
    id: LP_BERADROME_KODIAK_OHM_HONEY,
    pool: LP_KODIAK_OHM_HONEY,
    rewardVault: BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V2,
    tokens: [ERC20_HONEY, ERC20_OHM],
  },
  {
    kind: "kodiak",
    id: INFRARED_KODIAK_OHM_HONEY_VAULT,
    pool: LP_KODIAK_OHM_HONEY,
    rewardVault: INFRARED_KODIAK_OHM_HONEY_VAULT,
    tokens: [ERC20_HONEY, ERC20_OHM],
  },
  {
    kind: "kodiak",
    id: BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT,
    pool: LP_KODIAK_OHM_HONEY,
    rewardVault: BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT,
    tokens: [ERC20_HONEY, ERC20_OHM],
  },
];

export const BERACHAIN: ChainConfig = {
  chainId: 80094,
  blockchain: "Berachain",
  rpcUrl: "https://rpc.berachain.com",
  ohmToken: ERC20_OHM,
  nativeToken: NATIVE_BERA,
  tokens: [
    token(ERC20_IBERA, "Volatile", false, false),
    token(ERC20_IBGT, "Volatile", false, false),
    token(ERC20_LBGT, "Volatile", false, false),
    token(ERC20_STARGATE_USDC, "Stable", true, false),
    token(ERC20_HONEY, "Stable", true, false),
    token(ERC20_WBERA, "Volatile", true, true),
    token(NATIVE_BERA, "Volatile", true, true),
    token(LP_KODIAK_OHM_HONEY, "Protocol-Owned Liquidity", true, false),
    token(LP_BERADROME_KODIAK_OHM_HONEY, "Protocol-Owned Liquidity", true, false),
    token(INFRARED_KODIAK_OHM_HONEY_VAULT, "Protocol-Owned Liquidity", true, false),
    token(BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT, "Protocol-Owned Liquidity", true, false),
  ],
  names,
  abbreviations: {
    [ERC20_IBERA]: "iBERA",
    [ERC20_IBGT]: "iBGT",
    [ERC20_LBGT]: "lBGT",
    [ERC20_STARGATE_USDC]: "USDC.e",
    [ERC20_WBERA]: "wBERA",
    [NATIVE_BERA]: "BERA",
  },
  protocolAddresses: PROTOCOL_ADDRESSES,
  circulatingSupplyWallets: PROTOCOL_ADDRESSES,
  treasuryBlacklist: { [ERC20_OHM]: [DAO_MULTISIG, DAO_OPS_MULTISIG, TRSRY] },
  basePriceFeeds: {
    [ERC20_HONEY]: addr("0x4BAD96DD1C7D541270a0C92e1D4e5f12EEEA7a57"),
    [ERC20_STARGATE_USDC]: addr("0x4BAD96DD1C7D541270a0C92e1D4e5f12EEEA7a57"),
  },
  liquidityHandlers: [
    { kind: "univ3", tokens: [ERC20_HONEY, ERC20_WBERA], id: LP_UNISWAP_V3_WBERA_HONEY },
    { kind: "univ3", tokens: [ERC20_IBERA, ERC20_WBERA], id: LP_KODIAK_IBERA_WBERA_3000 },
    { kind: "univ3", tokens: [ERC20_IBERA, ERC20_WBERA], id: LP_KODIAK_IBERA_WBERA_500 },
    ...ownedLiquidityHandlers,
    { kind: "univ3", tokens: [ERC20_IBGT, ERC20_WBERA], id: LP_KODIAK_IBGT_WBERA },
    { kind: "stable", tokens: [NATIVE_BERA, ERC20_WBERA], id: "bera-wbera" },
    {
      kind: "balancer",
      tokens: [ERC20_LBGT, ERC20_WBERA],
      vault: BEX_VAULT,
      id: LP_BEX_LBGT_WBERA_ID,
    },
  ],
  ownedLiquidityHandlers,
};
