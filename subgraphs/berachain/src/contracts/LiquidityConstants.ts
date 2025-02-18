import { PriceHandler } from "../../../shared/src/price/PriceHandler";
import { PriceHandlerRemapping } from "../../../shared/src/price/PriceHandlerRemapping";
import { PriceHandlerUniswapV3Quoter } from "../../../shared/src/price/PriceHandlerUniswapV3Quoter";
import { PriceHandlerKodiakIsland } from "../price/PriceHandlerKodiakIsland";
import { BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT, ERC20_HONEY, ERC20_IBERA, ERC20_OHM, ERC20_WBERA, LP_BERADROME_KODIAK_OHM_HONEY, LP_KODIAK_IBERA_WBERA, LP_KODIAK_OHM_HONEY, LP_UNISWAP_V3_WBERA_HONEY, NATIVE_BERA } from "./Constants";
import { getContractName } from "./Contracts";


const KODIAK_QUOTER = "0x644C8D6E501f7C994B74F5ceA96abe65d0BA662B".toLowerCase();

// Owned liquidity
const kodiakOhmHoney = new PriceHandlerKodiakIsland([ERC20_HONEY, ERC20_OHM], KODIAK_QUOTER, LP_KODIAK_OHM_HONEY, null, null, getContractName);
const beradromeKodiakOhmHoney = new PriceHandlerKodiakIsland([ERC20_HONEY, ERC20_OHM], KODIAK_QUOTER, LP_KODIAK_OHM_HONEY, BERADROME_KODIAK_OHM_HONEY_REWARD_VAULT, LP_BERADROME_KODIAK_OHM_HONEY, getContractName);

export const OWNED_LIQUIDITY_HANDLERS = [kodiakOhmHoney, beradromeKodiakOhmHoney];

// Price handlers
// Price lookup is enabled for these tokens
export const PRICE_HANDLERS: PriceHandler[] = [
    new PriceHandlerUniswapV3Quoter([ERC20_HONEY, ERC20_WBERA], KODIAK_QUOTER, LP_UNISWAP_V3_WBERA_HONEY, getContractName),
    kodiakOhmHoney,
    beradromeKodiakOhmHoney,
    new PriceHandlerUniswapV3Quoter([ERC20_IBERA, ERC20_WBERA], KODIAK_QUOTER, LP_KODIAK_IBERA_WBERA, getContractName),
    new PriceHandlerRemapping(NATIVE_BERA, ERC20_WBERA, getContractName),
  ];
