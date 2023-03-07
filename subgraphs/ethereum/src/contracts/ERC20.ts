import { Address, BigInt, log } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../../shared/src/utils/Decimals";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { ERC20TokenSnapshot } from "../../generated/schema";
import { getContractName } from "../utils/Constants";

export function getOrCreateERC20TokenSnapshot(address: string, blockNumber: BigInt): ERC20TokenSnapshot {
    const FUNC = "getOrCreateERC20TokenSnapshot";
    const snapshotId = `${address.toLowerCase()}/${blockNumber.toString()}`;
    let token = ERC20TokenSnapshot.load(snapshotId);
    if (token == null) {
        token = new ERC20TokenSnapshot(snapshotId);
        token.address = Address.fromString(address);

        const erc20Contract = ERC20.bind(Address.fromString(address));
        // decimals() will revert if the contract has not yet been deployed
        const decimalsResult = erc20Contract.try_decimals();
        // Only set the values if there has been a deployment
        if (!decimalsResult.reverted) {
            token.decimals = erc20Contract.decimals();
        }
        else {
            log.debug("{}: call to decimals() on ERC20 contract {} ({}) reverted. Setting decimals to 0.", [FUNC, getContractName(address), address]);
            token.decimals = 0;
        }

        // Only calculate totalSupply if the contract call is successful, and there is a valid decimals number
        const totalSupplyResult = erc20Contract.try_totalSupply();
        if (!decimalsResult.reverted && !totalSupplyResult.reverted) {
            token.totalSupply = toDecimal(erc20Contract.totalSupply(), token.decimals);
        }

        token.save();
    }

    return token;
}

export function getERC20Decimals(address: string, blockNumber: BigInt): number {
    return getOrCreateERC20TokenSnapshot(address, blockNumber).decimals;
}
