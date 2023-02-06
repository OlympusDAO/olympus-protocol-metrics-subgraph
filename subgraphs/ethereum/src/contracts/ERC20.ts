import { Address, BigInt } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../../shared/src/utils/Decimals";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { ERC20TokenSnapshot } from "../../generated/schema";

export function getOrCreateERC20TokenSnapshot(address: string, blockNumber: BigInt): ERC20TokenSnapshot {
    const snapshotId = `${address.toLowerCase()}/${blockNumber.toString()}`;
    let token = ERC20TokenSnapshot.load(snapshotId);
    if (token == null) {
        token = new ERC20TokenSnapshot(snapshotId);
        token.address = Address.fromString(address);

        const erc20Contract = ERC20.bind(Address.fromString(address));
        token.decimals = erc20Contract.decimals();
        token.totalSupply = toDecimal(erc20Contract.totalSupply(), token.decimals);

        token.save();
    }

    return token;
}

export function getERC20Decimals(address: string, blockNumber: BigInt): number {
    return getOrCreateERC20TokenSnapshot(address, blockNumber).decimals;
}
