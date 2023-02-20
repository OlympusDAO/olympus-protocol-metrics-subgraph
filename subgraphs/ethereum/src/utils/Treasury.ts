import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { createOrUpdateTokenRecord, getIsTokenLiquid } from "../../../shared/src/utils/TokenRecordHelper";
import { TRSRY } from "../../../shared/src/Wallets";
import { BLOCKCHAIN, ERC20_TOKENS, getContractName } from "./Constants";
import { getERC20DecimalBalance } from "./ContractHelper";

function getTreasuryBalance(tokenAddress: string, blockNumber: BigInt): BigDecimal | null {
    return getERC20DecimalBalance(tokenAddress, TRSRY, blockNumber);
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