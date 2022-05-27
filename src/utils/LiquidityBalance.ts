import { BigInt } from "@graphprotocol/graph-ts";

/**
 * For a given contract, this class keeps track of the balance
 * for a given address.
 */
export class LiquidityBalances {
  contract: string;
  balances: Map<string, BigInt>;

  constructor(contract: string) {
    this.contract = contract;
    this.balances = new Map<string, BigInt>();
  }

  addBalance(address: string, balance: BigInt): void {
    this.balances.set(address, balance);
  }

  /**
   * Gets the addresses that have corresponding balances.
   *
   * @returns string[]
   */
  getAddresses(): Array<string> {
    return this.balances.keys();
  }

  /**
   * Gets the balance for a given address.
   *
   * @param address
   * @returns BigInt or null
   */
  getBalance(address: string): BigInt | null {
    return this.balances.get(address);
  }

  /**
   * Returns the sum of all balances
   *
   * @returns BigInt
   */
  getTotalBalance(): BigInt {
    let totalBalance = BigInt.fromString("0");

    for (let i = 0; i < this.balances.size; i++) {
      totalBalance = totalBalance.plus(this.balances.values()[i]);
    }

    return totalBalance;
  }
}
