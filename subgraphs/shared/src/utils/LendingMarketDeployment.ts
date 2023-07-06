import {
    BigDecimal,
    BigInt
} from "@graphprotocol/graph-ts";

export class LendingMarketDeployment {
    protected token: string;
    protected blockNumber: BigInt;
    protected amount: BigDecimal;
    protected address: string;

    // Constructor
    constructor(token: string, blockNumber: BigInt, amount: BigDecimal, address: string) {
        this.token = token;
        this.blockNumber = blockNumber;
        this.amount = amount;
        this.address = address;
    }

    // Getter methods
    getToken(): string {
        return this.token;
    }

    getBlockNumber(): BigInt {
        return this.blockNumber;
    }

    getAmount(): BigDecimal {
        return this.amount;
    }

    getAddress(): string {
        return this.address;
    }
}