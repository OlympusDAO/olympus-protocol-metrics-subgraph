import {
    SUSHI_OHMDAI_PAIR, SUSHI_XSUSHI_ETH_PAIR, SUSHI_USDC_ETH_PAIR, SUSHI_CVX_ETH_PAIR, SUSHI_OHMDAI_PAIRV2_BLOCK, SUSHI_OHMDAI_PAIRV2, UNI_FXS_ETH_PAIR, UNI_ETH_WBTC_PAIR
} from './Constants'
import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { UniswapV2Pair } from '../../generated/ProtocolMetrics/UniswapV2Pair';
import { UniswapV3Pair } from '../../generated/ProtocolMetrics/UniswapV3Pair';
import { toDecimal } from './Decimals'


let BIG_DECIMAL_1E8 = BigDecimal.fromString('1e8')
let BIG_DECIMAL_1E9 = BigDecimal.fromString('1e9')
let BIG_DECIMAL_1E10 = BigDecimal.fromString('1e10')
let BIG_DECIMAL_1E12 = BigDecimal.fromString('1e12')

export function getETHUSDRate(): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(SUSHI_USDC_ETH_PAIR))

    let reserves = pair.getReserves()
    let reserve0 = reserves.value0.toBigDecimal()
    let reserve1 = reserves.value1.toBigDecimal()

    let ethRate = reserve0.div(reserve1).times(BIG_DECIMAL_1E12)
    log.debug("ETH rate {}", [ethRate.toString()])
    
    return ethRate
}

export function getBTCUSDRate(): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(UNI_ETH_WBTC_PAIR))

    let reserves = pair.getReserves()
    let reserve0 = reserves.value0.toBigDecimal()
    let reserve1 = reserves.value1.toBigDecimal()

    let btcRate = getETHUSDRate().div(reserve0.div(reserve1).times(BIG_DECIMAL_1E10))
    log.debug("BTC rate {}", [btcRate.toString()])
    
    return btcRate
}

export function getOHMUSDRate(block: BigInt): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(SUSHI_OHMDAI_PAIR))

    if(block.gt(BigInt.fromString(SUSHI_OHMDAI_PAIRV2_BLOCK))){
        pair = UniswapV2Pair.bind(Address.fromString(SUSHI_OHMDAI_PAIRV2))
    }

    let reserves = pair.getReserves()
    let reserve0 = reserves.value0.toBigDecimal()
    let reserve1 = reserves.value1.toBigDecimal()

    let ohmRate = reserve1.div(reserve0).div(BIG_DECIMAL_1E9)
    log.debug("OHM rate {}", [ohmRate.toString()])

    return ohmRate
}

export function getXsushiUSDRate(): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(SUSHI_XSUSHI_ETH_PAIR))

    let reserves = pair.getReserves()
    let reserve0 = reserves.value0.toBigDecimal()
    let reserve1 = reserves.value1.toBigDecimal()

    let xsushiRate = reserve1.div(reserve0).times(getETHUSDRate())
    log.debug("xsushiRate rate {}", [xsushiRate.toString()])

    return xsushiRate

}

export function getFXSUSDRate(): BigDecimal {
    let pair = UniswapV3Pair.bind(Address.fromString(UNI_FXS_ETH_PAIR))

    let priceETH = pair.slot0().value0.times(pair.slot0().value0).toBigDecimal()
    log.debug("fxs priceETH {}", [priceETH.toString()])

    let priceDiv = BigInt.fromI32(2).pow(192).toBigDecimal()
    priceETH = priceETH.div(priceDiv)

    let priceUSD = priceETH.times(getETHUSDRate()) 

    log.debug("fxs rate {}", [priceUSD.toString()])

    return priceUSD
}

export function getCVXUSDRate(): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(SUSHI_CVX_ETH_PAIR))

    let reserves = pair.getReserves()
    let reserve0 = reserves.value0.toBigDecimal()
    let reserve1 = reserves.value1.toBigDecimal()

    let xsushiRate = reserve1.div(reserve0).times(getETHUSDRate())
    log.debug("cvx rate {}", [xsushiRate.toString()])

    return xsushiRate

}

//(slp_treasury/slp_supply)*(2*sqrt(lp_dai * lp_ohm))
export function getDiscountedPairUSD(lp_amount: BigInt, pair_adress: string): BigDecimal{
    let pair = UniswapV2Pair.bind(Address.fromString(pair_adress))

    let total_lp = pair.totalSupply()
    let lp_token_1 = toDecimal(pair.getReserves().value0, 9)
    let lp_token_2 = toDecimal(pair.getReserves().value1, 18)
    let kLast = lp_token_1.times(lp_token_2).truncate(0).digits

    let part1 = toDecimal(lp_amount,18).div(toDecimal(total_lp,18))
    let two = BigInt.fromI32(2)

    let sqrt = kLast.sqrt();
    let part2 = toDecimal(two.times(sqrt), 0)
    let result = part1.times(part2)
    return result
}

export function getDiscountedPairLUSD(lp_amount: BigInt, pair_adress: string): BigDecimal{
    let pair = UniswapV2Pair.bind(Address.fromString(pair_adress))

    let total_lp = pair.totalSupply()
    let lp_token_1 = toDecimal(pair.getReserves().value0, 18)
    let lp_token_2 = toDecimal(pair.getReserves().value1, 9)
    let kLast = lp_token_1.times(lp_token_2).truncate(0).digits

    let part1 = toDecimal(lp_amount,18).div(toDecimal(total_lp,18))
    let two = BigInt.fromI32(2)

    let sqrt = kLast.sqrt();
    let part2 = toDecimal(two.times(sqrt), 0)
    let result = part1.times(part2)
    return result
}

export function getPairUSD(lp_amount: BigInt, pair_adress: string, block: BigInt): BigDecimal{
    let pair = UniswapV2Pair.bind(Address.fromString(pair_adress))
    let total_lp = pair.totalSupply()
    let lp_token_0 = pair.getReserves().value0
    let lp_token_1 = pair.getReserves().value1
    let ownedLP = toDecimal(lp_amount,18).div(toDecimal(total_lp,18))
    let ohm_value = toDecimal(lp_token_0, 9).times(getOHMUSDRate(block))
    let total_lp_usd = ohm_value.plus(toDecimal(lp_token_1, 18))

    return ownedLP.times(total_lp_usd)
}

export function getPairLUSD(lp_amount: BigInt, pair_adress: string, block: BigInt): BigDecimal{
    let pair = UniswapV2Pair.bind(Address.fromString(pair_adress))
    let total_lp = pair.totalSupply()
    let lp_token_0 = pair.getReserves().value0
    let lp_token_1 = pair.getReserves().value1
    let ownedLP = toDecimal(lp_amount,18).div(toDecimal(total_lp,18))
    let ohm_value = toDecimal(lp_token_1, 9).times(getOHMUSDRate(block))
    let total_lp_usd = ohm_value.plus(toDecimal(lp_token_0, 18))

    return ownedLP.times(total_lp_usd)
}

export function getPairWETH(lp_amount: BigInt, pair_adress: string, block: BigInt): BigDecimal{
    let pair = UniswapV2Pair.bind(Address.fromString(pair_adress))
    let total_lp = pair.totalSupply()
    let lp_token_0 = pair.getReserves().value0
    let lp_token_1 = pair.getReserves().value1
    let ownedLP = toDecimal(lp_amount,18).div(toDecimal(total_lp,18))
    let ohm_value = toDecimal(lp_token_0, 9).times(getOHMUSDRate(block))
    let eth_value = toDecimal(lp_token_1, 18).times(getETHUSDRate())
    let total_lp_usd = ohm_value.plus(eth_value)

    return ownedLP.times(total_lp_usd)
}