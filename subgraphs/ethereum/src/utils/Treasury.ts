import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { TokenRecord } from "../../../../common/generated/schema";
import { toDecimal } from "../../../../common/src/utils/Decimals";
import { createOrUpdateTokenRecord, getIsTokenLiquid } from "../../../../common/src/utils/TokenRecordHelper";
import { TRSRY } from "../../../../common/src/Wallets";
import { BLOCKCHAIN, ERC20_TOKENS, getContractName } from "./Constants";
import { getERC20 } from "./ContractHelper";

function getTreasuryBalance(tokenAddress: string, blockNumber: BigInt): BigDecimal | null {
    const tokenContract = getERC20(tokenAddress, blockNumber);
    if (!tokenContract) {
        log.warning("getTreasuryBalance: unable to bind with ERC20 contract for token {}", [getContractName(tokenAddress)]);
        return null;
    }

    /**
     * Calling `getReserveBalance` on the treasury contract would return the token
     * balance and the debt (old treasury balances), which would distort the values.
     * 
     * Hence, we use a simple token balance instead.
     */
    return toDecimal(
        tokenContract.balanceOf(Address.fromString(TRSRY)),
        tokenContract.decimals(),
    );
}

export function getTreasuryRecords(timestamp: BigInt, tokenAddress: string, price: BigDecimal, blockNumber: BigInt): TokenRecord[] {
    const records: TokenRecord[] = [];

    const balance = getTreasuryBalance(tokenAddress, blockNumber);
    if (!balance || balance.equals(BigDecimal.zero())) return records;

    records.push(
        createOrUpdateTokenRecord(
            timestamp,
            getContractName(tokenAddress),
            tokenAddress,
            getContractName(TRSRY),
            TRSRY,
            price,
            balance,
            blockNumber,
            getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
            ERC20_TOKENS,
            BLOCKCHAIN,
        ),
    );

    return records;
}