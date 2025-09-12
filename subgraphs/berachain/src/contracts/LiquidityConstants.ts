import { PriceHandler } from "../../../shared/src/price/PriceHandler";
import { PriceHandlerBalancer } from "../../../shared/src/price/PriceHandlerBalancer";
import { PriceHandlerRemapping } from "../../../shared/src/price/PriceHandlerRemapping";
import { PriceHandlerUniswapV3Quoter } from "../../../shared/src/price/PriceHandlerUniswapV3Quoter";
import { PriceHandlerUniswapV3Path } from "../../../shared/src/price/PriceHandlerUniswapV3Path";
import { PriceHandlerKodiakIsland } from "../price/PriceHandlerKodiakIsland";
import { BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V1, BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V2, BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT, BEX_VAULT, ERC20_HONEY, ERC20_IBERA, ERC20_IBGT, ERC20_LBGT, ERC20_OHM, ERC20_WBERA, INFRARED_KODIAK_OHM_HONEY_VAULT, LP_BERADROME_KODIAK_OHM_HONEY, LP_BEX_LBGT_WBERA, LP_BEX_LBGT_WBERA_ID, LP_KODIAK_IBERA_WBERA, LP_KODIAK_IBGT_WBERA, LP_KODIAK_OHM_HONEY, LP_UNISWAP_V3_WBERA_HONEY, NATIVE_BERA } from "./Constants";
import { getContractName } from "./Contracts";

const KODIAK_QUOTER = "0x644C8D6E501f7C994B74F5ceA96abe65d0BA662B".toLowerCase();

// UniV3 path (packed bytes) for iBERA →(500)→ WBERA →(3000)→ HONEY
// Decomposed: IBERA (0x9b67...), fee 500 (0x0001f4), WBERA (0x6969...), fee 3000 (0x000bb8), HONEY (0xfcbd...)
// Built previously with: cast abi-encode --packed "(address,uint24,address,uint24,address)" ...
const PATH_IBERA_TO_HONEY = "0x9b6761bf2397bb5a6624a856cc84a3a14dcd3fe50001f46969696969696969696969696969696969696969000bb8fcbd14dc51f0a4d49d5e53c2e0950e0bc26d0dce";

// Owned liquidity
const kodiakOhmHoney = new PriceHandlerKodiakIsland([ERC20_HONEY, ERC20_OHM], KODIAK_QUOTER, LP_KODIAK_OHM_HONEY, null, null, getContractName);
const beradromeKodiakOhmHoneyV1 = new PriceHandlerKodiakIsland([ERC20_HONEY, ERC20_OHM], KODIAK_QUOTER, LP_KODIAK_OHM_HONEY, BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V1, LP_BERADROME_KODIAK_OHM_HONEY, getContractName);
const beradromeKodiakOhmHoneyV2 = new PriceHandlerKodiakIsland([ERC20_HONEY, ERC20_OHM], KODIAK_QUOTER, LP_KODIAK_OHM_HONEY, BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT_V2, LP_BERADROME_KODIAK_OHM_HONEY, getContractName);
const infraredKodiakOhmHoney = new PriceHandlerKodiakIsland([ERC20_HONEY, ERC20_OHM], KODIAK_QUOTER, LP_KODIAK_OHM_HONEY, INFRARED_KODIAK_OHM_HONEY_VAULT, INFRARED_KODIAK_OHM_HONEY_VAULT, getContractName);
const beraHubKodiakOhmHoney = new PriceHandlerKodiakIsland([ERC20_HONEY, ERC20_OHM], KODIAK_QUOTER, LP_KODIAK_OHM_HONEY, BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT, BERAHUB_KODIAK_OHM_HONEY_REWARD_VAULT, getContractName);
export const OWNED_LIQUIDITY_HANDLERS = [kodiakOhmHoney, beradromeKodiakOhmHoneyV1, beradromeKodiakOhmHoneyV2, infraredKodiakOhmHoney, beraHubKodiakOhmHoney];

// Price handlers
// Price lookup is enabled for these tokens
export const PRICE_HANDLERS: PriceHandler[] = [
  new PriceHandlerUniswapV3Quoter([ERC20_HONEY, ERC20_WBERA], KODIAK_QUOTER, LP_UNISWAP_V3_WBERA_HONEY, getContractName),
  // Direct path-based quote for iBERA pricing (iBERA→WBERA→HONEY)
  new PriceHandlerUniswapV3Path(KODIAK_QUOTER, PATH_IBERA_TO_HONEY, getContractName),
  kodiakOhmHoney,
  beradromeKodiakOhmHoneyV1,
  beradromeKodiakOhmHoneyV2,
  beraHubKodiakOhmHoney,
  new PriceHandlerUniswapV3Quoter([ERC20_IBERA, ERC20_WBERA], KODIAK_QUOTER, LP_KODIAK_IBERA_WBERA, getContractName),
  new PriceHandlerUniswapV3Quoter([ERC20_IBGT, ERC20_WBERA], KODIAK_QUOTER, LP_KODIAK_IBGT_WBERA, getContractName),
  new PriceHandlerRemapping(NATIVE_BERA, ERC20_WBERA, getContractName),
  new PriceHandlerBalancer([ERC20_LBGT, ERC20_WBERA], BEX_VAULT, LP_BEX_LBGT_WBERA_ID, getContractName),
];
