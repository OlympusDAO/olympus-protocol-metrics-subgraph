import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ContractNameLookup } from "../../../shared/src/contracts/ContractLookup";
import { PriceHandlerKodiakIsland } from "../../../shared/src/price/PriceHandlerKodiakIsland";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { BeradromeKodiakIslandRewardVault } from "../../generated/TokenRecords-berachain/BeradromeKodiakIslandRewardVault";

export class PriceHandlerKodiakIslandBeradrome extends PriceHandlerKodiakIsland {
    protected static readonly CLASS: string = "PriceHandlerKodiakIslandBeradrome";
    protected rewardVault: string;

    constructor(tokens: string[], quoter: string, poolAddress: string, rewardVault: string, contractLookup: ContractNameLookup) {
        super(tokens, quoter, poolAddress, contractLookup);
        this.rewardVault = rewardVault;
    }

    private getRewardVaultContract(block: BigInt): BeradromeKodiakIslandRewardVault | null {
        const FUNCTION = `${PriceHandlerKodiakIsland.CLASS}: getRewardVaultContract:`;
        const contract = BeradromeKodiakIslandRewardVault.bind(Address.fromString(this.rewardVault));

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
     * This gets the balance of the reward vault held by the given wallet, instead of the balance of the pool token.
     *
     * @param walletAddress
     * @param block
     * @returns
     */
    getBalance(walletAddress: string, block: BigInt): BigDecimal {
        const FUNCTION = `${PriceHandlerKodiakIsland.CLASS}: getBalance:`;
        const rewardVaultContract = this.getRewardVaultContract(block);
        if (!rewardVaultContract) {
            log.warning("{} Unable to determine balance as the contract ({}) reverted at block {}", [
                FUNCTION,
                this.contractLookup(this.poolAddress),
                block.toString(),
            ]);
            return BigDecimal.zero();
        }

        const poolContract = this.getContract(block);
        if (!poolContract) {
            log.warning("{} Unable to determine balance as the contract ({}) reverted at block {}", [
                FUNCTION,
                this.contractLookup(this.poolAddress),
                block.toString(),
            ]);
            return BigDecimal.zero();
        }

        const balance = toDecimal(rewardVaultContract.balanceOf(Address.fromString(walletAddress)), poolContract.decimals());
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
}
