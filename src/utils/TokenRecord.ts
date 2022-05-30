import { BigDecimal } from "@graphprotocol/graph-ts";
import { JSONEncoder } from "assemblyscript-json";

/**
 * Represents the balance of a single token from a single source.
 *
 * e.g. DAI in the treasury V3 wallet
 */
export class TokenRecord {
  name: string;
  source: string;
  sourceAddress: string;
  rate: BigDecimal;
  balance: BigDecimal;

  constructor(
    name: string,
    source: string,
    sourceAddress: string,
    rate: BigDecimal,
    balance: BigDecimal,
  ) {
    this.name = name;
    this.source = source;
    this.sourceAddress = sourceAddress;
    this.rate = rate;
    this.balance = balance;
  }

  getValue(): BigDecimal {
    return this.balance.times(this.rate);
  }

  /**
   * Returns a JSON-like dictionary in string format.
   *
   * @returns
   */
  toString(): string {
    const encoder = new JSONEncoder();
    this.encode(encoder);
    return encoder.toString();
  }

  encode(encoder: JSONEncoder): void {
    encoder.pushObject(null);
    encoder.setString("name", this.name);
    encoder.setString("source", this.source);
    encoder.setString("sourceAddress", this.sourceAddress);
    encoder.setString("rate", this.rate.toString());
    encoder.setString("balance", this.balance.toString());
    encoder.setString("value", this.getValue().toString());
    encoder.popObject();
  }
}

/**
 * Represents related token balances.
 *
 * e.g. DAI in treasury wallet v1,
 * DAI in treasury wallet v2
 */
export class TokenRecords {
  records: TokenRecord[];

  constructor() {
    this.records = new Array<TokenRecord>();
  }

  push(element: TokenRecord): void {
    this.records.push(element);
  }

  combine(records: TokenRecords): void {
    const array = records.records;

    for (let i = 0; i < array.length; i++) {
      this.records.push(array[i]);
    }
  }

  getBalance(): BigDecimal {
    // NOTE: asc spits a TS2304 error with the callback function if using `reduce`
    let balance = BigDecimal.fromString("0");

    for (let i = 0; i < this.records.length; i++) {
      balance = balance.plus(this.records[i].balance);
    }

    return balance;
  }

  getValue(): BigDecimal {
    // NOTE: asc spits a TS2304 error with the callback function if using `reduce`
    let value = BigDecimal.fromString("0");

    for (let i = 0; i < this.records.length; i++) {
      value = value.plus(this.records[i].getValue());
    }

    return value;
  }

  /**
   * Returns a JSON-like string representation of the TokenRecords
   *
   * e.g.
   * [
   *    TokenRecord.toString(),
   *    TokenRecord.toString(),
   *    TokenRecord.toString(),
   * ]
   *
   * @returns
   */
  toString(): string {
    const encoder = new JSONEncoder();
    this.encode(encoder);
    return encoder.toString();
  }

  /**
   * Returns an array containing stringified output
   * of TokenRecord.
   *
   * @returns Array<string>
   */
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  toStringArray(singleQuote: boolean = false): Array<string> {
    const array = new Array<string>();

    for (let i = 0; i < this.records.length; i++) {
      let record = this.records[i].toString();
      if (singleQuote) {
        record = record.replaceAll('"', "'");
      }

      array.push(record);
    }

    return array;
  }

  encode(encoder: JSONEncoder): void {
    encoder.pushObject(null);
    encoder.pushArray("records");

    for (let i = 0; i < this.records.length; i++) {
      encoder.setString(null, this.records[i].toString());
    }

    encoder.popArray();

    encoder.setString("balance", this.getBalance().toString());
    encoder.setString("value", this.getValue().toString());
    encoder.popObject();
  }
}
