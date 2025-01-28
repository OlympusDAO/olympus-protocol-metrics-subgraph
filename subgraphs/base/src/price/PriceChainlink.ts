import { Address, BigDecimal } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../../shared/src/utils/Decimals";
import { ChainlinkPriceFeed } from "../../generated/TokenRecords-base/ChainlinkPriceFeed";
import { ERC20_WETH, ERC20_USDC } from "../contracts/Constants";

const tokenPriceFeedMap: Map<string, string> = new Map<string, string>();
tokenPriceFeedMap.set(ERC20_WETH, "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70".toLowerCase());
tokenPriceFeedMap.set(ERC20_USDC, "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B".toLowerCase());

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
