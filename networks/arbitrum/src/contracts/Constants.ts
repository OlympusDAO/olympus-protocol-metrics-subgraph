import { TokenCategoryStable, TokenCategoryVolatile, TokenDefinition } from "../../../shared/src/contracts/TokenDefinition";

export const ERC20_FRAX = "0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F".toLowerCase();
export const ERC20_JONES = "0x10393c20975cf177a3513071bc110f7962cd67da".toLowerCase();
export const ERC20_MAGIC = "0x539bde0d7dbd336b79148aa742883198bbf60342".toLowerCase();
export const ERC20_USDC = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8".toLowerCase();
export const ERC20_VSTA = "0xa684cd057951541187f288294a1e1c2646aa2d24".toLowerCase();
export const ERC20_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1".toLowerCase();

export const LP_UNISWAP_V3_WETH_USDC = "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443".toLowerCase();
export const LP_UNISWAP_V2_JONES_WETH = "0xe8ee01ae5959d3231506fcdef2d5f3e85987a39c".toLowerCase();
export const LP_UNISWAP_V2_MAGIC_WETH = "0xb7e50106a5bd3cf21af210a755f9c8740890a8c9".toLowerCase();
export const LP_BALANCER_POOL_WETH_VESTA = "0xc61ff48f94d801c1ceface0289085197b5ec44f000020000000000000000004d";
export const LP_BALANCER_POOL_MAGIC_USDC = "0xb3028ca124b80cfe6e9ca57b70ef2f0ccc41ebd40002000000000000000000ba";

export const BALANCER_VAULT = "0x040d1EdC9569d4Bab2D15287Dc5A4F10F56a56B8".toLowerCase();

export const ERC20_TOKENS_ARBITRUM = new Map<string, TokenDefinition>();
ERC20_TOKENS_ARBITRUM.set(ERC20_FRAX, new TokenDefinition(ERC20_FRAX, TokenCategoryStable, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_JONES, new TokenDefinition(ERC20_JONES, TokenCategoryVolatile, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_MAGIC, new TokenDefinition(ERC20_MAGIC, TokenCategoryVolatile, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_USDC, new TokenDefinition(ERC20_USDC, TokenCategoryStable, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_VSTA, new TokenDefinition(ERC20_VSTA, TokenCategoryVolatile, true, false));
ERC20_TOKENS_ARBITRUM.set(ERC20_WETH, new TokenDefinition(ERC20_WETH, TokenCategoryVolatile, true, true));

export const CONTRACT_NAME_MAP = new Map<string, string>();
CONTRACT_NAME_MAP.set(ERC20_FRAX, "FRAX");
CONTRACT_NAME_MAP.set(ERC20_JONES, "JONES");
CONTRACT_NAME_MAP.set(ERC20_MAGIC, "MAGIC");
CONTRACT_NAME_MAP.set(ERC20_USDC, "USDC");
CONTRACT_NAME_MAP.set(ERC20_VSTA, "VSTA");
CONTRACT_NAME_MAP.set(ERC20_WETH, "WETH");
CONTRACT_NAME_MAP.set(LP_BALANCER_POOL_MAGIC_USDC, "Balancer MAGIC-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_BALANCER_POOL_WETH_VESTA, "Balancer wETH-VSTA Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_JONES_WETH, "UniswapV2 JONES-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_MAGIC_WETH, "UniswapV2 MAGIC-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V3_WETH_USDC, "UniswapV3 wETH-USDC Liquidity Pool");

// TODO add gOHM price

// Balancer
// WETH-WBTC-USDC: 0x64541216bafffeec8ea535bb71fbc927831d0595000100000000000000000002

// Native ETH
// veMAGIC
// JONES pool

// gOHM: 0x8D9bA570D6cb60C7e3e0F31343Efe75AB8E65FB1

// gOHM-wETH
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
