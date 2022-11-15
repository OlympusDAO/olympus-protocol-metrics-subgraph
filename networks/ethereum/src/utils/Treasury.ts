import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { createOrUpdateTokenRecord, getIsTokenLiquid } from "../../../shared/src/utils/TokenRecordHelper";
import { TRSRY } from "../../../shared/src/Wallets";
import { Treasury } from "../../generated/ProtocolMetrics/Treasury";
import { TokenRecord } from "../../generated/schema";
import { BLOCKCHAIN, ERC20_TOKENS, getContractName } from "./Constants";
import { getERC20 } from "./ContractHelper";

function getTreasuryBalance(tokenAddress: string, blockNumber: BigInt): BigDecimal | null {
    const tokenContract = getERC20(tokenAddress, blockNumber);
    if (!tokenContract) {
        log.warning("getTreasuryBalance: unable to bind with ERC20 contract for token {}", [getContractName(tokenAddress)]);
        return null;
    }

    const treasuryContract = Treasury.bind(Address.fromString(TRSRY));
    const reserves = treasuryContract.try_getReserveBalance(Address.fromString(tokenAddress));
    if (reserves.reverted) {
        log.warning("getTreasuryBalance: treasury contract reverted at block {}. Skipping", [blockNumber.toString()]);
        return null;
    }

    return toDecimal(
        reserves.value,
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