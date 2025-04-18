import { Address, BigDecimal } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../../shared/src/utils/Decimals";
import { ChainlinkPriceFeed } from "../../generated/TokenRecords-berachain/ChainlinkPriceFeed";
import { ERC20_HONEY, ERC20_STARGATE_USDC } from "../contracts/Constants";

const tokenPriceFeedMap: Map<string, string> = new Map<string, string>();
tokenPriceFeedMap.set(ERC20_HONEY, "0x4BAD96DD1C7D541270a0C92e1D4e5f12EEEA7a57".toLowerCase()); // Redstone USDC (since 1:1 with USDC)
tokenPriceFeedMap.set(ERC20_STARGATE_USDC, "0x4BAD96DD1C7D541270a0C92e1D4e5f12EEEA7a57".toLowerCase()); // Redstone USDC

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
