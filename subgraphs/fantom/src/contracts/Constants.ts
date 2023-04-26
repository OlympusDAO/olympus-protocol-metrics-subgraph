import { TokenCategoryPOL, TokenCategoryStable, TokenCategoryVolatile, TokenDefinition } from "../../../shared/src/contracts/TokenDefinition";
import { AAVE_ALLOCATOR, AAVE_ALLOCATOR_V2, BALANCER_ALLOCATOR, BONDS_DEPOSIT, BONDS_INVERSE_DEPOSIT, CONVEX_ALLOCATOR1, CONVEX_ALLOCATOR2, CONVEX_ALLOCATOR3, CONVEX_CVX_ALLOCATOR, CONVEX_CVX_VL_ALLOCATOR, CROSS_CHAIN_ARBITRUM, CROSS_CHAIN_FANTOM, CROSS_CHAIN_POLYGON, DAO_WALLET, LUSD_ALLOCATOR, RARI_ALLOCATOR, TREASURY_ADDRESS_V1, TREASURY_ADDRESS_V2, TREASURY_ADDRESS_V3, VEFXS_ALLOCATOR } from "../../../shared/src/Wallets";

export const BLOCKCHAIN = "Fantom";

export const ERC20_BEETS = "0xf24bcf4d1e507740041c9cfd2dddb29585adce1e".toLowerCase();
export const ERC20_BOO = "0x841fad6eae12c286d1fd18d1d525dffa75c7effe".toLowerCase();
export const ERC20_DAI = "0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E".toLowerCase();
export const ERC20_DEI = "0xDE1E704dae0B4051e80DAbB26ab6ad6c12262DA0".toLowerCase();
export const ERC20_FRAX = "0xdc301622e621166BD8E82f2cA0A26c13Ad0BE355".toLowerCase();
export const ERC20_GOHM = "0x91fa20244Fb509e8289CA630E5db3E9166233FDc".toLowerCase(); // Not added to ERC20_TOKENS_FANTOM
export const ERC20_LQDR = "0x10b620b2dbAC4Faa7D7FFD71Da486f5D44cd86f9".toLowerCase();
export const ERC20_OXD = "0xc5A9848b9d145965d821AaeC8fA32aaEE026492d".toLowerCase();
export const ERC20_USDC = "0x04068da6c83afcfa0e13ba15a6696662335d5b75".toLowerCase();
export const ERC20_WETH = "0x74b23882a30290451a17c44f4f05243b6b58c76d".toLowerCase();
export const ERC20_WFTM = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83".toLowerCase();

export const LP_UNISWAP_V2_BOO_WFTM = "0xec7178f4c41f346b2721907f5cf7628e388a7a58".toLowerCase();
export const LP_UNISWAP_V2_LQDR_WFTM = "0x4fe6f19031239f105f753d1df8a0d24857d0caa2".toLowerCase();
export const LP_UNISWAP_V2_WFTM_BEETS = "0x648a7452da25b4fb4bdb79badf374a8f8a5ea2b5".toLowerCase();
export const LP_UNISWAP_V2_WFTM_ETH = "0xf0702249f4d3a25cd3ded7859a165693685ab577".toLowerCase();
export const LP_UNISWAP_V2_WFTM_GOHM = "0xae9bba22e87866e48ccacff0689afaa41eb94995".toLowerCase();
export const LP_UNISWAP_V2_WFTM_OXD = "0xcb6eab779780c7fd6d014ab90d8b10e97a1227e2".toLowerCase();
export const LP_UNISWAP_V2_WFTM_USDC = "0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c".toLowerCase();

export const ERC20_TOKENS_FANTOM = new Map<string, TokenDefinition>();
ERC20_TOKENS_FANTOM.set(ERC20_BEETS, new TokenDefinition(ERC20_BEETS, TokenCategoryVolatile, true, false));
ERC20_TOKENS_FANTOM.set(ERC20_BOO, new TokenDefinition(ERC20_BOO, TokenCategoryVolatile, true, false));
ERC20_TOKENS_FANTOM.set(ERC20_DAI, new TokenDefinition(ERC20_DAI, TokenCategoryStable, true, false));
ERC20_TOKENS_FANTOM.set(ERC20_DEI, new TokenDefinition(ERC20_DEI, TokenCategoryStable, true, false));
ERC20_TOKENS_FANTOM.set(ERC20_FRAX, new TokenDefinition(ERC20_FRAX, TokenCategoryStable, true, false));
ERC20_TOKENS_FANTOM.set(ERC20_LQDR, new TokenDefinition(ERC20_LQDR, TokenCategoryVolatile, true, false));
ERC20_TOKENS_FANTOM.set(ERC20_OXD, new TokenDefinition(ERC20_OXD, TokenCategoryVolatile, true, true));
ERC20_TOKENS_FANTOM.set(ERC20_USDC, new TokenDefinition(ERC20_USDC, TokenCategoryStable, true, false));
ERC20_TOKENS_FANTOM.set(ERC20_WETH, new TokenDefinition(ERC20_WETH, TokenCategoryVolatile, true, true));
ERC20_TOKENS_FANTOM.set(ERC20_WFTM, new TokenDefinition(ERC20_WFTM, TokenCategoryVolatile, true, true));

ERC20_TOKENS_FANTOM.set(LP_UNISWAP_V2_WFTM_GOHM, new TokenDefinition(LP_UNISWAP_V2_WFTM_GOHM, TokenCategoryPOL, true, false));

export const OHM_TOKENS = [ERC20_GOHM];

export const CONTRACT_NAME_MAP = new Map<string, string>();
CONTRACT_NAME_MAP.set(AAVE_ALLOCATOR_V2, "Aave Allocator V2");
CONTRACT_NAME_MAP.set(AAVE_ALLOCATOR, "Aave Allocator V1");
CONTRACT_NAME_MAP.set(BALANCER_ALLOCATOR, "Balancer Allocator");
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
CONTRACT_NAME_MAP.set(ERC20_BEETS, "Beethoven");
CONTRACT_NAME_MAP.set(ERC20_BOO, "SpookySwap");
CONTRACT_NAME_MAP.set(ERC20_DAI, "DAI");
CONTRACT_NAME_MAP.set(ERC20_DEI, "Deus Finance");
CONTRACT_NAME_MAP.set(ERC20_FRAX, "FRAX");
CONTRACT_NAME_MAP.set(ERC20_GOHM, "Governance OHM");
CONTRACT_NAME_MAP.set(ERC20_LQDR, "Liquid Driver");
CONTRACT_NAME_MAP.set(ERC20_OXD, "0xDAO");
CONTRACT_NAME_MAP.set(ERC20_USDC, "USDC");
CONTRACT_NAME_MAP.set(ERC20_WFTM, "Wrapped ETH");
CONTRACT_NAME_MAP.set(ERC20_WFTM, "Wrapped Fantom");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_BOO_WFTM, "UniswapV2 BOO-wFTM Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_LQDR_WFTM, "UniswapV2 LQDR-wFTM Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_WFTM_BEETS, "UniswapV2 wFTM-BEETS Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_WFTM_ETH, "UniswapV2 wFTM-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_WFTM_OXD, "UniswapV2 wFTM-OXD Liquidity Pool");
CONTRACT_NAME_MAP.set(LP_UNISWAP_V2_WFTM_USDC, "UniswapV2 wFTM-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(LUSD_ALLOCATOR, "LUSD Allocator");
CONTRACT_NAME_MAP.set(RARI_ALLOCATOR, "Rari Allocator");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V1, "Treasury Wallet V1");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V2, "Treasury Wallet V2");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V3, "Treasury Wallet V3");
CONTRACT_NAME_MAP.set(VEFXS_ALLOCATOR, "VeFXS Allocator");

export const CONTRACT_ABBREVIATION_MAP = new Map<string, string>();
CONTRACT_NAME_MAP.set(ERC20_BEETS, "BEETS");
CONTRACT_NAME_MAP.set(ERC20_BOO, "BOO");
CONTRACT_NAME_MAP.set(ERC20_DAI, "DAI");
CONTRACT_NAME_MAP.set(ERC20_DEI, "DEI");
CONTRACT_NAME_MAP.set(ERC20_FRAX, "FRAX");
CONTRACT_NAME_MAP.set(ERC20_GOHM, "gOHM");
CONTRACT_NAME_MAP.set(ERC20_LQDR, "LQDR");
CONTRACT_NAME_MAP.set(ERC20_OXD, "OXD");
CONTRACT_NAME_MAP.set(ERC20_WETH, "wETH");
CONTRACT_NAME_MAP.set(ERC20_WFTM, "wFTM");
