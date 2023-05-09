import { Address, BigDecimal, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction, log } from "matchstick-as";

import { toBigInt } from "../../shared/src/utils/Decimals";
import { ERC20_DAI, ERC20_FRAX, ERC20_LUSD, ERC20_USDC, ERC20_WETH } from "../src/utils/Constants";
import { getPriceFeed } from "../src/utils/PriceChainlink";

export function mockPriceFeed(token: string, price: BigDecimal): void {
    const priceFeed = getPriceFeed(token);
    if (priceFeed == null) {
        throw new Error(`No price feed for token ${token}`);
    }

    const PRICE_FEED_DECIMALS = 8;
    const priceFeedAddress = Address.fromString(priceFeed!);

    createMockedFunction(priceFeedAddress, "decimals", "decimals():(uint8)").returns([
        ethereum.Value.fromI32(PRICE_FEED_DECIMALS),
    ]);

    log.debug("Mocking price feed value {} for token {}", [price.toString(), token]);
    createMockedFunction(priceFeedAddress, "latestAnswer", "latestAnswer():(int256)").returns([
        ethereum.Value.fromSignedBigInt(toBigInt(price, PRICE_FEED_DECIMALS)),
    ]);
}

export function mockStablecoinsPriceFeeds(): void {
    const tokens = [ERC20_DAI, ERC20_FRAX, ERC20_LUSD, ERC20_USDC];
    for (let i = 0; i < tokens.length; i++) {
        mockPriceFeed(tokens[i], BigDecimal.fromString("1"));
    }
}

/**
 * In March 2023, ETH lookups were changed to use the Chainlink price feed. Tests are setup to use
 * a Uniswap pool. Calling this function ensures that the pool is used.
 */
export function mockEthPriceFeedRevert(): void {
    const priceFeed = getPriceFeed(ERC20_WETH);
    if (priceFeed == null) {
        throw new Error(`No price feed for token ${ERC20_WETH}`);
    }

    const priceFeedAddress = Address.fromString(priceFeed!);

    createMockedFunction(priceFeedAddress, "decimals", "decimals():(uint8)").reverts();

    createMockedFunction(priceFeedAddress, "latestAnswer", "latestAnswer():(int256)").reverts();
}