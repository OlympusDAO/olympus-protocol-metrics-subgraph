import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Address } from "@graphprotocol/graph-ts";

import { ERC4626 } from "../../generated/Price/ERC4626";
import { ContractNameLookup } from "../contracts/ContractLookup";
import { toDecimal } from "../utils/Decimals";
import { addressesEqual } from "../utils/StringHelper";
import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

const CLASS = "PriceHandlerERC4626";

export class PriceHandlerERC4626 implements PriceHandler {
    protected vaultAddress: string;
    protected assetAddress: string;
    protected contractLookup: ContractNameLookup;

    constructor(vaultAddress: string, assetAddress: string, contractLookup: ContractNameLookup) {
        this.vaultAddress = vaultAddress;
        this.assetAddress = assetAddress;
        this.contractLookup = contractLookup;
    }

    getId(): string {
        return this.vaultAddress;
    }

    private getVault(block: BigInt): ERC4626 | null {
        const FUNCTION = `${CLASS}: getVault:`;
        const vault = ERC4626.bind(Address.fromString(this.vaultAddress));

        if (vault === null || vault.try_asset().reverted) {
            log.debug("{} contract ({}) reverted at block {}", [
                FUNCTION,
                this.contractLookup(this.vaultAddress),
                block.toString(),
            ]);
            return null;
        }

        return vault;
    }

    exists(): boolean {
        return this.getVault(BigInt.zero()) !== null;
    }

    matches(tokenAddress: string): boolean {
        // Only provide the price of the vault token
        return addressesEqual(this.vaultAddress, tokenAddress);
    }

    getPrice(tokenAddress: string, priceLookup: PriceLookup, block: BigInt): PriceLookupResult | null {
        const FUNCTION = `${CLASS}: getPrice:`;

        const vault = this.getVault(block);
        if (vault === null) {
            return null;
        }

        // Check that the token address matches the asset of the vault
        if (!addressesEqual(this.vaultAddress, tokenAddress)) {
            throw new Error(`${FUNCTION} token ${this.contractLookup(tokenAddress)} (${tokenAddress}) is not the vault token ${this.contractLookup(this.vaultAddress)} (${this.vaultAddress})`);
        }

        // Get the price of the asset
        const assetPrice = priceLookup(this.assetAddress, block, this.getId());
        if (assetPrice === null) {
            return null;
        }
        log.info("{}: 1 {} is {} USD", [
            FUNCTION,
            this.contractLookup(this.assetAddress),
            assetPrice.price.toString(),
        ]);

        // Get 1 share in terms of the underlying token
        const decimals = vault.decimals();
        const sharesToUnderlying = toDecimal(vault.convertToAssets(BigInt.fromU32(10).pow(decimals)), decimals);
        log.info("{}: 1 share of {} is {} of the underlying", [
            FUNCTION,
            this.contractLookup(this.vaultAddress),
            sharesToUnderlying.toString(),
        ]);

        // Get the price of 1 share in terms of the underlying token
        const sharePrice = assetPrice.price.times(sharesToUnderlying);
        log.info("{}: 1 share of {} is {} USD", [
            FUNCTION,
            this.contractLookup(this.vaultAddress),
            sharePrice.toString(),
        ]);

        return {
            price: sharePrice,
            liquidity: new BigDecimal(BigInt.fromU64(U64.MAX_VALUE)),
        };
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
