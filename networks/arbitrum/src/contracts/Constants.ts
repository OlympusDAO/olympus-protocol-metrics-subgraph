import { TokenCategoryPOL, TokenCategoryStable, TokenCategoryVolatile, TokenDefinition } from "../../../shared/src/contracts/TokenDefinition";
import { AAVE_ALLOCATOR, AAVE_ALLOCATOR_V2, BALANCER_ALLOCATOR, BONDS_DEPOSIT, BONDS_INVERSE_DEPOSIT, CONVEX_ALLOCATOR1, CONVEX_ALLOCATOR2, CONVEX_ALLOCATOR3, CONVEX_CVX_ALLOCATOR, CONVEX_CVX_VL_ALLOCATOR, CROSS_CHAIN_ARBITRUM, CROSS_CHAIN_FANTOM, CROSS_CHAIN_POLYGON, DAO_WALLET, LUSD_ALLOCATOR, RARI_ALLOCATOR, TREASURY_ADDRESS_V1, TREASURY_ADDRESS_V2, TREASURY_ADDRESS_V3, VEFXS_ALLOCATOR } from "../../../shared/src/Wallets";

export const ERC20_FRAX = "0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F".toLowerCase();
export const ERC20_GOHM = "0x8D9bA570D6cb60C7e3e0F31343Efe75AB8E65FB1".toLowerCase(); // Not added to ERC20_TOKENS_ARBITRUM
export const ERC20_JONES = "0x10393c20975cf177a3513071bc110f7962cd67da".toLowerCase();
export const ERC20_MAGIC = "0x539bde0d7dbd336b79148aa742883198bbf60342".toLowerCase();
export const ERC20_USDC = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8".toLowerCase();
export const ERC20_VSTA = "0xa684cd057951541187f288294a1e1c2646aa2d24".toLowerCase();
export const ERC20_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1".toLowerCase();

export const LP_BALANCER_POOL_MAGIC_USDC = "0xb3028ca124b80cfe6e9ca57b70ef2f0ccc41ebd40002000000000000000000ba";
export const LP_BALANCER_POOL_WETH_VESTA = "0xc61ff48f94d801c1ceface0289085197b5ec44f000020000000000000000004d";
export const LP_UNISWAP_V2_GOHM_WETH = "0xaa5bd49f2162ffdc15634c87a77ac67bd51c6a6d".toLowerCase();
export const LP_UNISWAP_V2_JONES_WETH = "0xe8ee01ae5959d3231506fcdef2d5f3e85987a39c".toLowerCase();
export const LP_UNISWAP_V2_MAGIC_WETH = "0xb7e50106a5bd3cf21af210a755f9c8740890a8c9".toLowerCase();
export const LP_UNISWAP_V3_WETH_USDC = "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443".toLowerCase();

export const BALANCER_VAULT = "0x040d1EdC9569d4Bab2D15287Dc5A4F10F56a56B8".toLowerCase();

export const JONES_STAKING = "0xb94d1959084081c5a11C460012Ab522F5a0FD756".toLowerCase();
export const JONES_STAKING_POOL_IDS: u64[] = [0];

export const TREASUREDAO_MINING = "0xdf19f1216aa406df8bc585246bee7d96933f285f".toLowerCase();
export const TREASUREDAO_MINING_IDs = [0];

export const ERC20_TOKENS_ARBITRUM = new Map<string, TokenDefinition>();
ERC20_TOKENS_ARBITRUM.set(ERC20_FRAX, new TokenDefinition(ERC20_FRAX, TokenCategoryStable, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_JONES, new TokenDefinition(ERC20_JONES, TokenCategoryVolatile, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_MAGIC, new TokenDefinition(ERC20_MAGIC, TokenCategoryVolatile, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_USDC, new TokenDefinition(ERC20_USDC, TokenCategoryStable, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_VSTA, new TokenDefinition(ERC20_VSTA, TokenCategoryVolatile, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_WETH, new TokenDefinition(ERC20_WETH, TokenCategoryVolatile, true, true));

ERC20_TOKENS_ARBITRUM.set(LP_BALANCER_POOL_MAGIC_USDC, new TokenDefinition(LP_BALANCER_POOL_MAGIC_USDC, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_BALANCER_POOL_WETH_VESTA, new TokenDefinition(LP_BALANCER_POOL_WETH_VESTA, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_UNISWAP_V2_GOHM_WETH, new TokenDefinition(LP_UNISWAP_V2_GOHM_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_UNISWAP_V2_JONES_WETH, new TokenDefinition(LP_UNISWAP_V2_JONES_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_UNISWAP_V2_MAGIC_WETH, new TokenDefinition(LP_UNISWAP_V2_MAGIC_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS_ARBITRUM.set(LP_UNISWAP_V3_WETH_USDC, new TokenDefinition(LP_UNISWAP_V3_WETH_USDC, TokenCategoryPOL, true, false));

export const OHM_TOKENS = [ERC20_GOHM];

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
CONTRACT_NAME_MAP.set(DAO_WALLET, "DAO Wallet");
CONTRACT_NAME_MAP.set(ERC20_FRAX, "FRAX");
CONTRACT_NAME_MAP.set(ERC20_GOHM, "Governance OHM");
CONTRACT_NAME_MAP.set(ERC20_JONES, "JonesDAO");
CONTRACT_NAME_MAP.set(ERC20_MAGIC, "TreasureDAO");
CONTRACT_NAME_MAP.set(ERC20_USDC, "USDC");
CONTRACT_NAME_MAP.set(ERC20_VSTA, "Vesta");
CONTRACT_NAME_MAP.set(ERC20_WETH, "Wrapped ETH");
CONTRACT_NAME_MAP.set(JONES_STAKING, "JONES Staking");
CONTRACT_NAME_MAP.set(LP_BALANCER_POOL_MAGIC_USDC, "Balancer MAGIC-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_BALANCER_POOL_WETH_VESTA, "Balancer wETH-VSTA Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_GOHM_WETH, "UniswapV2 gOHM-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_JONES_WETH, "UniswapV2 JONES-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_MAGIC_WETH, "UniswapV2 MAGIC-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V3_WETH_USDC, "UniswapV3 wETH-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(LUSD_ALLOCATOR, "LUSD Allocator");
CONTRACT_NAME_MAP.set(RARI_ALLOCATOR, "Rari Allocator");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V1, "Treasury Wallet V1");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V2, "Treasury Wallet V2");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V3, "Treasury Wallet V3");
CONTRACT_NAME_MAP.set(VEFXS_ALLOCATOR, "VeFXS Allocator");

export const CONTRACT_ABBREVIATION_MAP = new Map<string, string>();
CONTRACT_ABBREVIATION_MAP.set(ERC20_GOHM, "gOHM");
CONTRACT_ABBREVIATION_MAP.set(ERC20_JONES, "JONES");
CONTRACT_ABBREVIATION_MAP.set(ERC20_MAGIC, "MAGIC");
CONTRACT_ABBREVIATION_MAP.set(ERC20_VSTA, "VSTA");
CONTRACT_ABBREVIATION_MAP.set(ERC20_WETH, "wETH");

// Native ETH
// veMAGIC

// jgOHM-gOHM

// Assets: https://debank.com/profile/0x012bbf0481b97170577745d2167ee14f63e2ad4c

/**
 * Pass list/map of base tokens: token -> resolution function
 * functions to determine if token matches a category/resolution function
 * token orientation
 *
 * getPairHandlerNonOhmValue should support gOHM. Addresses to be injected
 *
 * algorithms (UniV2, Balancer, etc) should move to shared. Edge-cases (UST) remain.
 */
