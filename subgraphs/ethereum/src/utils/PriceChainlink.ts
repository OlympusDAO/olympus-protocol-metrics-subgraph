import { Address, BigDecimal } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../../shared/src/utils/Decimals";
import { ChainlinkPriceFeed } from "../../generated/ProtocolMetrics/ChainlinkPriceFeed";
import { ERC20_ADAI, ERC20_DAI, ERC20_FRAX, ERC20_LUSD, ERC20_USDC, ERC20_USDE, ERC20_USDS, ERC20_WETH } from "./Constants";

const tokenPriceFeedMap: Map<string, string> = new Map<string, string>();
tokenPriceFeedMap.set(ERC20_ADAI, "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9".toLowerCase());
tokenPriceFeedMap.set(ERC20_DAI, "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9".toLowerCase());
tokenPriceFeedMap.set(ERC20_FRAX, "0xb9e1e3a9feff48998e45fa90847ed4d467e8bcfd".toLowerCase());
tokenPriceFeedMap.set(ERC20_LUSD, "0x3D7aE7E594f2f2091Ad8798313450130d0Aba3a0".toLowerCase());
tokenPriceFeedMap.set(ERC20_USDC, "0x8fffffd4afb6115b954bd326cbe7b4ba576818f6".toLowerCase());
tokenPriceFeedMap.set(ERC20_USDE, "0xa569d910839Ae8865Da8F8e70FfFb0cBA869F961".toLowerCase());
tokenPriceFeedMap.set(ERC20_USDS, "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9".toLowerCase()); // Use the DAI price feed for USDS as there is not one for USDS
tokenPriceFeedMap.set(ERC20_WETH, "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419".toLowerCase());

export function getPriceFeedTokens(): string[] {
    return tokenPriceFeedMap.keys();
}

export function getPriceFeed(token: string): string | null {
    const tokenLower = token.toLowerCase();
    if (!tokenPriceFeedMap.has(tokenLower)) {
        return null;
    }

    return tokenPriceFeedMap.get(tokenLower);
}

export function getPriceFeedValue(tokenAddress: string): BigDecimal | null {
    const tokenAddressLower = tokenAddress.toLowerCase();
    if (!tokenPriceFeedMap.has(tokenAddressLower)) {
        return null;
    }

    const priceFeedAddress = tokenPriceFeedMap.get(tokenAddressLower);
    const priceFeed = ChainlinkPriceFeed.bind(Address.fromString(priceFeedAddress));
    const decimalsResult = priceFeed.try_decimals();
    const answerResult = priceFeed.try_latestAnswer();

    if (decimalsResult.reverted || answerResult.reverted) {
        return null;
    }

    return toDecimal(answerResult.value, decimalsResult.value);
}