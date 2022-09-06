export const ERC20_USDC = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8".toLowerCase();
export const ERC20_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1".toLowerCase();

export const LP_UNISWAP_V3_WETH_USDC = "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443".toLowerCase();

// Balancer
// WETH-WBTC-USDC: 0x64541216bafffeec8ea535bb71fbc927831d0595000100000000000000000002
// WETH-VSTA: 0xc61ff48f94d801c1ceface0289085197b5ec44f000020000000000000000004d
// MAGIC-USDC: 0xb3028ca124b80cfe6e9ca57b70ef2f0ccc41ebd40002000000000000000000ba

// JONES
// MAGIC
// veMAGIC
// VSTA

// Uniswap V3
// WETH-USDC: 0xc31e54c7a869b9fcbecc14363cf510d1c41fa443

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
