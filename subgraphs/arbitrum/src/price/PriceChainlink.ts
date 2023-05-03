import { Address, BigDecimal } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../../shared/src/utils/Decimals";
import { ChainlinkPriceFeed } from "../../generated/TokenRecords-arbitrum/ChainlinkPriceFeed";
import { ERC20_LUSD, ERC20_USDC, ERC20_WETH } from "../contracts/Constants";

const tokenPriceFeedMap: Map<string, string> = new Map<string, string>();
tokenPriceFeedMap.set(ERC20_LUSD, "0x0411d28c94d85a36bc72cb0f875dfa8371d8ffff".toLowerCase());
tokenPriceFeedMap.set(ERC20_USDC, "0x50834f3163758fcc1df9973b6e91f0f0f0434ad3".toLowerCase());
tokenPriceFeedMap.set(ERC20_WETH, "0x639fe6ab55c921f74e7fac1ee960c0b6293ba612".toLowerCase());

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