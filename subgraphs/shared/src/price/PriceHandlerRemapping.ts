import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { ContractNameLookup } from "../contracts/ContractLookup";
import { addressesEqual } from "../utils/StringHelper";
import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

const CLASS = "PriceHandlerRemapping";

export class PriceHandlerRemapping implements PriceHandler {
    protected assetAddress: string;
    protected destinationTokenAddress: string;
    protected contractLookup: ContractNameLookup;

    constructor(assetAddress: string, destinationTokenAddress: string, contractLookup: ContractNameLookup) {
        this.assetAddress = assetAddress;
        this.destinationTokenAddress = destinationTokenAddress;
        this.contractLookup = contractLookup;
    }

    getId(): string {
        return this.assetAddress;
    }

    exists(): boolean {
        return true;
    }

    matches(tokenAddress: string): boolean {
        return addressesEqual(this.assetAddress, tokenAddress);
    }

    getTokens(): string[] {
        return [this.assetAddress];
    }

    getPrice(tokenAddress: string, priceLookup: PriceLookup, block: BigInt): PriceLookupResult | null {
        // Look up the price of the destination token and return that
        return priceLookup(this.destinationTokenAddress, block, this.getId());
    }

    getTotalValue(excludedTokens: string[], priceLookup: PriceLookup, block: BigInt): BigDecimal | null {
        throw new Error(`${CLASS}: getTotalValue: not implemented`);
    }

    getUnitPrice(priceLookup: PriceLookup, block: BigInt): BigDecimal | null {
        throw new Error(`${CLASS}: getUnitPrice: not implemented`);
    }

    getBalance(walletAddress: string, block: BigInt): BigDecimal {
        throw new Error(`${CLASS}: getBalance: not implemented`);
    }

    getUnderlyingTokenBalance(walletAddress: string, tokenAddress: string, block: BigInt): BigDecimal {
        throw new Error(`${CLASS}: getUnderlyingTokenBalance: not implemented`);
    }
}
