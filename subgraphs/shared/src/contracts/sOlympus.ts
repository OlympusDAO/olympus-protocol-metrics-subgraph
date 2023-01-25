import { Address, BigInt, log } from "@graphprotocol/graph-ts";

import { sOlympusERC20 } from "../../generated/Price/sOlympusERC20";
import { sOlympusERC20V2 } from "../../generated/Price/sOlympusERC20V2";
import { sOlympusERC20V3 } from "../../generated/Price/sOlympusERC20V3";

export function getSOlympusERC20(
    contractAddress: string,
    currentBlockNumber: BigInt,
): sOlympusERC20 {
    log.debug("Binding sOlympusERC20 contract for address {}. Block number {}", [
        contractAddress,
        currentBlockNumber.toString(),
    ]);
    return sOlympusERC20.bind(Address.fromString(contractAddress));
}

export function getSOlympusERC20V2(
    contractAddress: string,
    currentBlockNumber: BigInt,
): sOlympusERC20V2 {
    log.debug("Binding sOlympusERC20V2 contract for address {}. Block number {}", [
        contractAddress,
        currentBlockNumber.toString(),
    ]);
    return sOlympusERC20V2.bind(Address.fromString(contractAddress));
}

export function getSOlympusERC20V3(
    contractAddress: string,
    currentBlockNumber: BigInt,
): sOlympusERC20V3 {
    log.debug("Binding sOlympusERC20V3 contract for address {}. Block number {}", [
        contractAddress,
        currentBlockNumber.toString(),
    ]);
    return sOlympusERC20V3.bind(Address.fromString(contractAddress));
}