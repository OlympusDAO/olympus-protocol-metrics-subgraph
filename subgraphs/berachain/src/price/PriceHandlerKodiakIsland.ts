import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";

import { UniswapV3Pair } from "../../../shared/generated/Price/UniswapV3Pair";
import { UniswapV3Quoter, UniswapV3Quoter__quoteExactInputSingleInputParamsStruct } from "../../../shared/generated/Price/UniswapV3Quoter";
import { ContractNameLookup } from "../../../shared/src/contracts/ContractLookup";
import { getERC20 } from "../../../shared/src/contracts/ERC20";
import { PriceHandler, PriceLookup, PriceLookupResult } from "../../../shared/src/price/PriceHandler";
import { arrayIncludesLoose } from "../../../shared/src/utils/ArrayHelper";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { addressesEqual } from "../../../shared/src/utils/StringHelper";
import { BeradromeKodiakIslandRewardVault } from "../../generated/TokenRecords-berachain/BeradromeKodiakIslandRewardVault";
import { KodiakIsland } from "../../generated/TokenRecords-berachain/KodiakIsland";

export class PriceHandlerKodiakIsland implements PriceHandler {
    protected static readonly CLASS: string = "PriceHandlerKodiakIsland";
    protected tokens: string[];
    protected quoter: string;
    protected poolAddress: string;
    protected rewardVault: string | null;
    protected rewardVaultToken: string | null;
    protected contractLookup: ContractNameLookup;

    constructor(tokens: string[], quoter: string, poolAddress: string, rewardVault: string | null, rewardVaultToken: string | null, contractLookup: ContractNameLookup) {
        // If the reward vault is set, the reward vault token must be set
        if (rewardVault !== null && rewardVaultToken === null) {
            throw new Error(`${PriceHandlerKodiakIsland.CLASS}: rewardVaultToken is null, but rewardVault is set`);
        }

        // If the reward vault is not set, the reward vault token must not be set
        if (rewardVault === null && rewardVaultToken !== null) {
            throw new Error(`${PriceHandlerKodiakIsland.CLASS}: rewardVaultToken is set, but rewardVault is not set`);
        }

        this.tokens = tokens;
        this.quoter = quoter;
        this.poolAddress = poolAddress;
        this.rewardVault = rewardVault;
        this.rewardVaultToken = rewardVaultToken;
        this.contractLookup = contractLookup;
    }

    protected getPoolTokenContract(block: BigInt): KodiakIsland | null {
        const FUNCTION = `${PriceHandlerKodiakIsland.CLASS}: getContract:`;
        const contract = KodiakIsland.bind(Address.fromString(this.poolAddress));

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

    private getRewardVaultContract(block: BigInt): BeradromeKodiakIslandRewardVault | null {
        const FUNCTION = `${PriceHandlerKodiakIsland.CLASS}: getRewardVaultContract:`;

        const rewardVault = this.rewardVault;
        if (rewardVault === null) {
            return null;
        }

        const contract = BeradromeKodiakIslandRewardVault.bind(Address.fromString(rewardVault));

        if (contract === null || contract.try_stakeToken().reverted) {
            log.debug("{} contract ({}) reverted at block {}", [
                FUNCTION,
                this.contractLookup(this.poolAddress),
                block.toString(),
            ]);
            return null;
        }

        return contract;
    }

    /**
     * Returns the unique identifier for the pool.
     *
     * This implementation returns the pool address by default.
     * If a reward vault is set, it will return the reward vault.
     *
     * @returns
     */
    getId(): string {
        const rewardVault = this.rewardVault;
        if (rewardVault !== null) {
            return rewardVault;
        }

        return this.poolAddress;
    }

    exists(): boolean {
        return this.getPoolTokenContract(BigInt.zero()) !== null;
    }

    matches(tokenAddress: string): boolean {
        return arrayIncludesLoose(this.tokens, tokenAddress);
    }

    getPrice(tokenAddress: string, priceLookup: PriceLookup, block: BigInt): PriceLookupResult | null {
        const FUNCTION = `${PriceHandlerKodiakIsland.CLASS}: getPrice:${this.getId()}:`;

        // Get the contract
        const contract = this.getPoolTokenContract(block);
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
        const poolFee = UniswapV3Pair.bind(contract.pool()).fee();

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
        quoteSingleInputParams[4] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2).pow(96)); // sqrtPriceLimitX96 max value

        const quoteOutputResult = quoter.quoteExactInputSingle(quoteSingleInputParams);
        const quoteOutputInt = quoteOutputResult.getAmountOut();
        const quoteOutput = toDecimal(quoteOutputInt, otherTokenDecimals);
        log.debug(
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
        const FUNCTION = `${PriceHandlerKodiakIsland.CLASS}: getTotalValue:${this.getId()}:`;
        const contract = this.getPoolTokenContract(block);
        if (!contract) {
            return null;
        }

        const token0 = contract.token0().toHexString();
        const token1 = contract.token1().toHexString();
        const reserves = contract.getUnderlyingBalances();

        const token0Rate = priceLookup(token0, block, null);
        if (!token0Rate) {
            log.warning("{} Unable to determine total value as the price of {} ({}) was null at block {}", [
                FUNCTION,
                this.contractLookup(token0),
                token0,
                block.toString(),
            ]);
            return null;
        }

        const token1Rate = priceLookup(token1, block, null);
        if (!token1Rate) {
            log.warning("{} Unable to determine total value as the price of {} ({}) was null at block {}", [
                FUNCTION,
                this.contractLookup(token1),
                token1,
                block.toString(),
            ]);
            return null;
        }

        // If the token is in {excludedTokens}, don't include its value
        const token0Value = arrayIncludesLoose(excludedTokens, token0)
            ? BigDecimal.zero()
            : toDecimal(reserves.getAmount0Current(), getERC20(token0, block).decimals()).times(token0Rate.price);
        const token1Value = arrayIncludesLoose(excludedTokens, token1)
            ? BigDecimal.zero()
            : toDecimal(reserves.getAmount1Current(), getERC20(token1, block).decimals()).times(token1Rate.price);

        return token0Value.plus(token1Value);
    }

    getUnitPrice(priceLookup: PriceLookup, block: BigInt): BigDecimal | null {
        const FUNCTION = `${PriceHandlerKodiakIsland.CLASS}: getUnitPrice:${this.getId()}:`;
        const contract = this.getPoolTokenContract(block);
        if (!contract) {
            return null;
        }

        const totalSupply = toDecimal(contract.totalSupply(), contract.decimals());
        const totalValue = this.getTotalValue([], priceLookup, block);
        if (!totalValue) {
            log.warning("{} Unable to determine unit rate as total value was null at block {}", [
                FUNCTION,
                block.toString(),
            ]);
            return null;
        }

        return totalValue.div(totalSupply);
    }

    getBalance(walletAddress: string, block: BigInt): BigDecimal {
        const FUNCTION = `${PriceHandlerKodiakIsland.CLASS}: getBalance:${this.getId()}:`;
        const poolTokenContract = this.getPoolTokenContract(block);
        if (!poolTokenContract) {
            log.warning("{} Unable to determine balance as the contract ({}) reverted at block {}", [
                FUNCTION,
                this.contractLookup(this.poolAddress),
                block.toString(),
            ]);
            return BigDecimal.zero();
        }

        let balance: BigDecimal;

        // If there is a reward vault, use the balance from that
        if (this.rewardVault !== null) {
            log.info("{} Using reward vault to determine balance, as it is set", [
                FUNCTION,
            ]);

            // Get the reward vault contract, which may not exist yet
            const rewardVaultContract = this.getRewardVaultContract(block);
            if (!rewardVaultContract) {
                return BigDecimal.zero();
            }

            // Get the balance of the reward vault
            balance = toDecimal(rewardVaultContract.balanceOf(Address.fromString(walletAddress)), poolTokenContract.decimals());
        } else {
            // Get the balance of the pool token
            balance = toDecimal(poolTokenContract.balanceOf(Address.fromString(walletAddress)), poolTokenContract.decimals());
        }

        log.info("{} Balance of {} ({}) in {} ({}) is {}", [
            FUNCTION,
            this.contractLookup(this.poolAddress),
            this.poolAddress,
            this.contractLookup(walletAddress),
            walletAddress,
            balance.toString(),
        ]);

        return balance;
    }

    getUnderlyingTokenBalance(walletAddress: string, tokenAddress: string, block: BigInt): BigDecimal {
        const FUNCTION = `${PriceHandlerKodiakIsland.CLASS}: getUnderlyingTokenBalance:${this.getId()}:`;
        const contract = this.getPoolTokenContract(block);
        if (!contract) {
            return BigDecimal.zero();
        }

        // Check that tokenAddress is either token0 or token1
        if (!addressesEqual(tokenAddress, contract.token0().toHexString()) && !addressesEqual(tokenAddress, contract.token1().toHexString())) {
            throw new Error(`${FUNCTION} token ${this.contractLookup(tokenAddress)} (${tokenAddress}) does not belong to LP ${this.contractLookup(this.poolAddress)} (${this.poolAddress})`);
        }

        // Get the balance of the pool token
        const walletBalance = this.getBalance(walletAddress, block);

        // Get the proportional balance of the token supply
        const contractDecimals = contract.decimals();
        const totalSupply = toDecimal(contract.totalSupply(), contractDecimals);
        const proportionalBalance: BigDecimal = walletBalance.div(totalSupply);

        // Calculate the balance of the underlying token
        const reserves = contract.getUnderlyingBalances();
        let underlyingBalanceInt: BigInt;
        if (tokenAddress == contract.token0().toHexString()) {
            underlyingBalanceInt = reserves.getAmount0Current();
        } else {
            underlyingBalanceInt = reserves.getAmount1Current();
        }

        const tokenContract = getERC20(tokenAddress, block);
        const underlyingBalance = toDecimal(underlyingBalanceInt, tokenContract.decimals());

        return proportionalBalance.times(underlyingBalance);
    }
}
