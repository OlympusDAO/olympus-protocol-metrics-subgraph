import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenCategoryPOL, TokenCategoryStable, TokenCategoryVolatile, TokenDefinition } from "../../../shared/src/contracts/TokenDefinition";
import { LendingMarketDeployment } from "../../../shared/src/utils/LendingMarketDeployment";
import { AAVE_ALLOCATOR, AAVE_ALLOCATOR_V2, BALANCER_ALLOCATOR, BONDS_DEPOSIT, BONDS_INVERSE_DEPOSIT, CONVEX_ALLOCATOR1, CONVEX_ALLOCATOR2, CONVEX_ALLOCATOR3, CONVEX_CVX_ALLOCATOR, CONVEX_CVX_VL_ALLOCATOR, CROSS_CHAIN_ARBITRUM, CROSS_CHAIN_FANTOM, CROSS_CHAIN_POLYGON, DAO_WALLET, DAO_WORKING_CAPITAL, LUSD_ALLOCATOR, OTC_ESCROW, RARI_ALLOCATOR, TREASURY_ADDRESS_V1, TREASURY_ADDRESS_V2, TREASURY_ADDRESS_V3, VEFXS_ALLOCATOR, WALLET_ADDRESSES } from "../../../shared/src/Wallets";

export const BLOCKCHAIN = "Arbitrum";

export const ERC20_ARB = "0x912ce59144191c1204e64559fe8253a0e49e6548".toLowerCase();
export const ERC20_FRAX = "0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F".toLowerCase();
export const ERC20_OHM = "0xf0cb2dc0db5e6c66B9a70Ac27B06b878da017028".toLowerCase();
export const ERC20_GOHM_SYNAPSE = "0x8D9bA570D6cb60C7e3e0F31343Efe75AB8E65FB1".toLowerCase(); // Not added to ERC20_TOKENS_ARBITRUM
export const ERC20_JONES = "0x10393c20975cf177a3513071bc110f7962cd67da".toLowerCase();
export const ERC20_LQTY = "0xfb9E5D956D889D91a82737B9bFCDaC1DCE3e1449".toLowerCase();
export const ERC20_LUSD = "0x93b346b6bc2548da6a1e7d98e9a421b42541425b".toLowerCase();
export const ERC20_MAGIC = "0x539bde0d7dbd336b79148aa742883198bbf60342".toLowerCase();
export const ERC20_USDC = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8".toLowerCase();
export const ERC20_VSTA = "0xa684cd057951541187f288294a1e1c2646aa2d24".toLowerCase();
export const ERC20_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1".toLowerCase();

export const LP_BALANCER_POOL_MAGIC_USDC = "0xb3028ca124b80cfe6e9ca57b70ef2f0ccc41ebd40002000000000000000000ba";
export const LP_BALANCER_POOL_WETH_VESTA = "0xc61ff48f94d801c1ceface0289085197b5ec44f000020000000000000000004d";
export const LP_BALANCER_POOL_WETH_OHM = "0x89dc7e71e362faf88d92288fe2311d25c6a1b5e0000200000000000000000423";
export const LP_BALANCER_POOL_OHM_USDC = "0xce6195089b302633ed60f3f427d1380f6a2bfbc7000200000000000000000424";
export const LP_UNISWAP_V2_GOHM_WETH = "0xaa5bd49f2162ffdc15634c87a77ac67bd51c6a6d".toLowerCase();
export const LP_UNISWAP_V2_JONES_GOHM_GOHM = "0x292d1587a6bb37e34574c9ad5993f221d8a5616c".toLowerCase();
export const LP_UNISWAP_V2_JONES_WETH = "0xe8ee01ae5959d3231506fcdef2d5f3e85987a39c".toLowerCase();
export const LP_UNISWAP_V2_LQTY_WETH = "0x8e78f0f6d116f94252d3bcd73d8ade63d415c1bf".toLowerCase();
export const LP_UNISWAP_V2_MAGIC_WETH = "0xb7e50106a5bd3cf21af210a755f9c8740890a8c9".toLowerCase();
export const LP_UNISWAP_V3_ARB_WETH = "0xc6f780497a95e246eb9449f5e4770916dcd6396a".toLowerCase();
export const LP_UNISWAP_V3_WETH_USDC = "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443".toLowerCase();

export const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8".toLowerCase();

export const JONES_STAKING = "0xb94d1959084081c5a11C460012Ab522F5a0FD756".toLowerCase();
export const JONES_STAKING_POOL_IDS: u64[] = [0];

export const TREASURE_ATLAS_MINE = "0xa0a89db1c899c49f98e6326b764bafcf167fc2ce".toLowerCase();

export const OLYMPUS_LENDER = "0x868C3ae18Fdea85bBb7a303e379c5B7e23b30F03".toLowerCase();

export const SILO_ADDRESS = "0x9992f660137979C1ca7f8b119Cd16361594E3681".toLowerCase();
export const SENTIMENT_LTOKEN = "0x3c34c679a76697e12e8a7496173487fea004f7c0".toLowerCase();

export const SILO_DEPLOYMENTS = new Array<LendingMarketDeployment>();
SILO_DEPLOYMENTS.push(new LendingMarketDeployment(ERC20_OHM, BigInt.fromString("99067079"), BigDecimal.fromString("25000"), SILO_ADDRESS)); // https://arbiscan.io/tx/0x55cabbd6cd41d2fa79a6c93743729bbfa85577ff3e92255f27bfd832344871f6
SILO_DEPLOYMENTS.push(new LendingMarketDeployment(ERC20_OHM, BigInt.fromString("100875469"), BigDecimal.fromString("25000"), SILO_ADDRESS)); // https://arbiscan.io/tx/0xf8c9d222481435330ca1a7b761e90ab3698c8b111b014776162f19050c1288b8

export const SENTIMENT_DEPLOYMENTS = new Array<LendingMarketDeployment>();
SENTIMENT_DEPLOYMENTS.push(new LendingMarketDeployment(ERC20_OHM, BigInt.fromString("100875583"), BigDecimal.fromString("5000"), SENTIMENT_LTOKEN)); // https://arbiscan.io/tx/0x5adab20ba57cf09a136c0cd1c61672c7e0d5249f4410f978f85a05a0de707e81

export const ERC20_TOKENS_ARBITRUM = new Map<string, TokenDefinition>();
ERC20_TOKENS_ARBITRUM.set(ERC20_ARB, new TokenDefinition(ERC20_ARB, TokenCategoryVolatile, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_FRAX, new TokenDefinition(ERC20_FRAX, TokenCategoryStable, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_JONES, new TokenDefinition(ERC20_JONES, TokenCategoryVolatile, true, false, BigDecimal.fromString("0.83")));
ERC20_TOKENS_ARBITRUM.set(ERC20_LQTY, new TokenDefinition(ERC20_LQTY, TokenCategoryVolatile, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_LUSD, new TokenDefinition(ERC20_LUSD, TokenCategoryStable, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_MAGIC, new TokenDefinition(ERC20_MAGIC, TokenCategoryVolatile, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_USDC, new TokenDefinition(ERC20_USDC, TokenCategoryStable, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_VSTA, new TokenDefinition(ERC20_VSTA, TokenCategoryVolatile, true, false, BigDecimal.fromString("0.77")));
ERC20_TOKENS_ARBITRUM.set(ERC20_WETH, new TokenDefinition(ERC20_WETH, TokenCategoryVolatile, true, true));
ERC20_TOKENS_ARBITRUM.set(LP_BALANCER_POOL_MAGIC_USDC, new TokenDefinition(LP_BALANCER_POOL_MAGIC_USDC, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_BALANCER_POOL_WETH_VESTA, new TokenDefinition(LP_BALANCER_POOL_WETH_VESTA, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_BALANCER_POOL_WETH_OHM, new TokenDefinition(LP_BALANCER_POOL_WETH_OHM, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_BALANCER_POOL_OHM_USDC, new TokenDefinition(LP_BALANCER_POOL_OHM_USDC, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_UNISWAP_V2_GOHM_WETH, new TokenDefinition(LP_UNISWAP_V2_GOHM_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_UNISWAP_V2_JONES_GOHM_GOHM, new TokenDefinition(LP_UNISWAP_V2_JONES_GOHM_GOHM, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_UNISWAP_V2_JONES_WETH, new TokenDefinition(LP_UNISWAP_V2_JONES_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_UNISWAP_V2_MAGIC_WETH, new TokenDefinition(LP_UNISWAP_V2_MAGIC_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_UNISWAP_V3_ARB_WETH, new TokenDefinition(LP_UNISWAP_V3_ARB_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_UNISWAP_V3_WETH_USDC, new TokenDefinition(LP_UNISWAP_V3_WETH_USDC, TokenCategoryPOL, true, false));

export const OHM_TOKENS = [ERC20_GOHM_SYNAPSE, ERC20_OHM];

const TREASURY_BLACKLIST = new Map<string, string[]>();

/**
 * OHM and gOHM in the following wallets are blacklisted (not indexed) as we do not want the value
 * being considered as part of the protocol or DAO treasuries.
 */
TREASURY_BLACKLIST.set(ERC20_GOHM_SYNAPSE, WALLET_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_OHM, WALLET_ADDRESSES);

/**
 * Some wallets (e.g. {DAO_WALLET}) have specific treasury assets mixed into them.
 * For this reason, the wallets to be used differ on a per-contract basis.
 *
 * This function returns the wallets that should be iterated over for the given
 * contract, {contractAddress}.
 *
 * @param contractAddress
 * @returns
 */
export const getWalletAddressesForContract = (contractAddress: string): string[] => {
  const walletAddresses = WALLET_ADDRESSES.slice(0);

  // If the contract isn't on the blacklist, return as normal
  if (!TREASURY_BLACKLIST.has(contractAddress.toLowerCase())) {
    log.debug("getWalletAddressesForContract: token {} is not on treasury blacklist", [contractAddress]);
    return walletAddresses;
  }

  // Otherwise remove the values in the blacklist
  // AssemblyScript doesn't yet have closures, so filter() cannot be used
  const walletBlacklist = TREASURY_BLACKLIST.get(contractAddress.toLowerCase());
  for (let i = 0; i < walletBlacklist.length; i++) {
    // If the blacklisted address is not in the array, skip
    const arrayIndex = walletAddresses.indexOf(walletBlacklist[i]);
    if (arrayIndex < 0) {
      continue;
    }

    // Otherwise the blacklist address is removed from the array in-place
    const splicedValues = walletAddresses.splice(arrayIndex, 1);
    log.debug("getWalletAddressesForContract: removed values: {}", [splicedValues.toString()]);
  }

  return walletAddresses;
};

/**
 * Defines the contract addresses that belong to the protocol & DAO treasuries.
 * 
 * This is normally deducted from total supply to determine circulating supply.
 */
export const CIRCULATING_SUPPLY_WALLETS = [
  BONDS_DEPOSIT,
  BONDS_INVERSE_DEPOSIT,
  CROSS_CHAIN_ARBITRUM,
  DAO_WALLET,
  DAO_WORKING_CAPITAL,
  OTC_ESCROW,
  TREASURY_ADDRESS_V1,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
]

export const CONTRACT_NAME_MAP = new Map<string, string>();
CONTRACT_NAME_MAP.set(AAVE_ALLOCATOR_V2, "Aave Allocator V2");
CONTRACT_NAME_MAP.set(AAVE_ALLOCATOR, "Aave Allocator V1");
CONTRACT_NAME_MAP.set(BALANCER_ALLOCATOR, "Balancer Allocator");
CONTRACT_NAME_MAP.set(BALANCER_VAULT, "Balancer Vault");
CONTRACT_NAME_MAP.set(BONDS_DEPOSIT, "Bond Depository");
CONTRACT_NAME_MAP.set(BONDS_INVERSE_DEPOSIT, "Bond (Inverse) Depository");
CONTRACT_NAME_MAP.set(CONVEX_ALLOCATOR1, "Convex Allocator 1");
CONTRACT_NAME_MAP.set(CONVEX_ALLOCATOR2, "Convex Allocator 2");
CONTRACT_NAME_MAP.set(CONVEX_ALLOCATOR3, "Convex Allocator 3");
CONTRACT_NAME_MAP.set(CONVEX_CVX_ALLOCATOR, "Convex Allocator");
CONTRACT_NAME_MAP.set(CONVEX_CVX_VL_ALLOCATOR, "Convex vlCVX Allocator");
CONTRACT_NAME_MAP.set(CROSS_CHAIN_ARBITRUM, "Cross-Chain Arbitrum");
CONTRACT_NAME_MAP.set(CROSS_CHAIN_FANTOM, "Cross-Chain Fantom");
CONTRACT_NAME_MAP.set(CROSS_CHAIN_POLYGON, "Cross-Chain Polygon");
CONTRACT_NAME_MAP.set(DAO_WALLET, "Treasury MS (Formerly DAO Wallet)");
CONTRACT_NAME_MAP.set(ERC20_ARB, "Arbitrum");
CONTRACT_NAME_MAP.set(ERC20_FRAX, "FRAX");
CONTRACT_NAME_MAP.set(ERC20_GOHM_SYNAPSE, "Governance OHM (Synapse)");
CONTRACT_NAME_MAP.set(ERC20_JONES, "JonesDAO");
CONTRACT_NAME_MAP.set(ERC20_LQTY, "Liquity");
CONTRACT_NAME_MAP.set(ERC20_LUSD, "Liquity USD");
CONTRACT_NAME_MAP.set(ERC20_MAGIC, "TreasureDAO");
CONTRACT_NAME_MAP.set(ERC20_OHM, "OHM");
CONTRACT_NAME_MAP.set(ERC20_USDC, "USDC");
CONTRACT_NAME_MAP.set(ERC20_VSTA, "Vesta");
CONTRACT_NAME_MAP.set(ERC20_WETH, "Wrapped ETH");
CONTRACT_NAME_MAP.set(JONES_STAKING, "JONES Staking");
CONTRACT_NAME_MAP.set(LP_BALANCER_POOL_MAGIC_USDC, "Balancer MAGIC-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_BALANCER_POOL_OHM_USDC, "Balancer OHM-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_BALANCER_POOL_WETH_OHM, "Balancer wETH-OHM Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_BALANCER_POOL_WETH_VESTA, "Balancer wETH-VSTA Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_GOHM_WETH, "UniswapV2 gOHM-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_JONES_GOHM_GOHM, "UniswapV2 jgOHM-gOHM Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_JONES_WETH, "UniswapV2 JONES-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_LQTY_WETH, "Ramses LQTY-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_MAGIC_WETH, "UniswapV2 MAGIC-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V3_ARB_WETH, "UniswapV3 ARB-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V3_WETH_USDC, "UniswapV3 wETH-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(LUSD_ALLOCATOR, "LUSD Allocator");
CONTRACT_NAME_MAP.set(OLYMPUS_LENDER, "Olympus Lender");
CONTRACT_NAME_MAP.set(RARI_ALLOCATOR, "Rari Allocator");
CONTRACT_NAME_MAP.set(SENTIMENT_LTOKEN, "Sentiment Finance");
CONTRACT_NAME_MAP.set(SILO_ADDRESS, "Silo Router");
CONTRACT_NAME_MAP.set(TREASURE_ATLAS_MINE, "TreasureDAO Atlas Mine");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V1, "Treasury Wallet V1");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V2, "Treasury Wallet V2");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V3, "Treasury Wallet V3");
CONTRACT_NAME_MAP.set(VEFXS_ALLOCATOR, "VeFXS Allocator");

export const CONTRACT_ABBREVIATION_MAP = new Map<string, string>();
CONTRACT_ABBREVIATION_MAP.set(ERC20_ARB, "ARB");
CONTRACT_ABBREVIATION_MAP.set(ERC20_GOHM_SYNAPSE, "gOHM");
CONTRACT_ABBREVIATION_MAP.set(ERC20_JONES, "JONES");
CONTRACT_ABBREVIATION_MAP.set(ERC20_LQTY, "LQTY");
CONTRACT_ABBREVIATION_MAP.set(ERC20_LUSD, "LUSD");
CONTRACT_ABBREVIATION_MAP.set(ERC20_MAGIC, "MAGIC");
CONTRACT_ABBREVIATION_MAP.set(ERC20_VSTA, "VSTA");
CONTRACT_ABBREVIATION_MAP.set(ERC20_WETH, "wETH");
