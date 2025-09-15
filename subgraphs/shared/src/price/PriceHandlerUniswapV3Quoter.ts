import { Address, BigDecimal, BigInt, ethereum,log } from "@graphprotocol/graph-ts";

import { UniswapV3Pair } from "../../generated/Price/UniswapV3Pair";
import { UniswapV3Quoter, UniswapV3Quoter__quoteExactInputSingleInputParamsStruct } from "../../generated/Price/UniswapV3Quoter";
import { ContractNameLookup } from "../contracts/ContractLookup";
import { getERC20 } from "../contracts/ERC20";
import { arrayIncludesLoose } from "../utils/ArrayHelper";
import { toDecimal } from "../utils/Decimals";
import { addressesEqual } from "../utils/StringHelper";
import { PriceHandler, PriceLookup, PriceLookupResult } from "./PriceHandler";

const CLASS = "PriceHandlerUniswapV3Quoter";

export class PriceHandlerUniswapV3Quoter implements PriceHandler {
    protected tokens: string[];
    protected quoter: string;
    protected poolAddress: string;
    protected contractLookup: ContractNameLookup;

    constructor(tokens: string[], quoter: string, poolAddress: string, contractLookup: ContractNameLookup) {
        this.tokens = tokens;
        this.quoter = quoter;
        this.poolAddress = poolAddress;
        this.contractLookup = contractLookup;
    }

    private getContract(block: BigInt): UniswapV3Pair | null {
        const FUNCTION = `${CLASS}: getContract:`;
        const contract = UniswapV3Pair.bind(Address.fromString(this.poolAddress));

        if (contract === null || contract.try_token0().reverted || contract.try_token1().reverted) {
            log.debug("{} contract ({}) reverted at block {}", [
                FUNCTION,
                this.contractLookup(this.poolAddress),
                block.toString(),
            ]);
            return null;
        }

        return contract;
    }

    getId(): string {
        return this.poolAddress;
    }

    exists(): boolean {
        return this.getContract(BigInt.zero()) !== null;
    }

    matches(tokenAddress: string): boolean {
        return arrayIncludesLoose(this.tokens, tokenAddress);
    }

    getTokens(): string[] {
        return this.tokens;
    }

    getPrice(tokenAddress: string, priceLookup: PriceLookup, block: BigInt): PriceLookupResult | null {
        const FUNCTION = `${CLASS}: ${this.getId()}: getPrice:`;

        // Get the contract
        const contract = this.getContract(block);
        if (contract === null) {
          log.debug("{} Cannot determine value as the contract ({}) reverted at block {}", [
            FUNCTION,
            this.contractLookup(this.poolAddress),
            block.toString(),
          ]);
          return null;
        }

        // Determine orientation of the pair
        const token0 = contract.token0();
        const token1 = contract.token1();

        if (
          !addressesEqual(tokenAddress, token0.toHexString()) &&
          !addressesEqual(tokenAddress, token1.toHexString())
        ) {
          throw new Error(
            `${FUNCTION} token ${this.contractLookup(
              tokenAddress,
            )} (${tokenAddress}) does not belong to LP ${this.contractLookup(this.poolAddress)} (${this.poolAddress
            })`,
          );
        }

        // Get the pool fee
        const poolFee = contract.fee();

        // Get the quoter contract
        const quoter = UniswapV3Quoter.bind(Address.fromString(this.quoter));

        // Get the other token
        const desiredToken = addressesEqual(tokenAddress, token0.toHexString()) ? token0 : token1;
        const otherToken = addressesEqual(tokenAddress, token0.toHexString()) ? token1 : token0;

        const desiredTokenDecimals = getERC20(desiredToken.toHexString(), block).decimals();
        const otherTokenDecimals = getERC20(otherToken.toHexString(), block).decimals();

        // Get the quantity of the other token for 1 of this token
        const quoteSingleInputParams = new UniswapV3Quoter__quoteExactInputSingleInputParamsStruct(5);
        quoteSingleInputParams[0] = ethereum.Value.fromAddress(Address.fromString(tokenAddress));
        quoteSingleInputParams[1] = ethereum.Value.fromAddress(otherToken);
        quoteSingleInputParams[2] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10).pow(u8(desiredTokenDecimals)));
        quoteSingleInputParams[3] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(poolFee));
        quoteSingleInputParams[4] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)); // no limit

        const quoteOutputResult = quoter.try_quoteExactInputSingle(quoteSingleInputParams);
        if (quoteOutputResult.reverted) {
            log.warning("{} Unable to determine price of {} ({}) at block {} due to reverted quoteExactInputSingle call", [
                FUNCTION,
                this.contractLookup(otherToken.toHexString()),
                otherToken.toHexString(),
                block.toString(),
            ]);
            return null;
        }

        const quoteOutputInt = quoteOutputResult.value.getAmountOut();
        const quoteOutput = toDecimal(quoteOutputInt, otherTokenDecimals);
        log.info(
            "{} Determined price of {} ({}) to be valued at {} per {} ({}) tokens",
            [
                FUNCTION,
                this.contractLookup(tokenAddress),
                tokenAddress,
                quoteOutput.toString(),
                this.contractLookup(otherToken.toHexString()),
                otherToken.toHexString(),
            ]
        );

        // Determine the price of the other token
        const otherTokenPrice = priceLookup(otherToken.toHexString(), block, this.getId());
        if (!otherTokenPrice || otherTokenPrice.price.equals(BigDecimal.zero())) {
            log.warning("{} Unable to determine price of {} ({}) at block {}", [
                FUNCTION,
                this.contractLookup(otherToken.toHexString()),
                otherToken.toHexString(),
                block.toString(),
            ]);
            return null;
        }

        const desiredTokenPrice = quoteOutput.times(otherTokenPrice.price);
        log.info("{} Price of {} ({}) is {}", [
            FUNCTION,
            this.contractLookup(tokenAddress),
            tokenAddress,
            desiredTokenPrice.toString(),
        ]);

        return {
            price: desiredTokenPrice,
            liquidity: BigDecimal.zero(), // TODO set liquidity
        }
    }

    getTotalValue(excludedTokens: string[], priceLookup: PriceLookup, block: BigInt): BigDecimal | null {
        return null;
    }

    getUnitPrice(priceLookup: PriceLookup, block: BigInt): BigDecimal | null {
        return null;
    }

    getBalance(walletAddress: string, block: BigInt): BigDecimal {
        return BigDecimal.zero();
    }

    getUnderlyingTokenBalance(walletAddress: string, tokenAddress: string, block: BigInt): BigDecimal {
        return BigDecimal.zero();
    }
}
