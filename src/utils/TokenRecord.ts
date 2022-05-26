import { BigDecimal } from "@graphprotocol/graph-ts";

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
    return (
      "{\n" +
      "name: " +
      this.name +
      ",\n" +
      "source: " +
      this.source +
      ",\n" +
      "sourceAddress: " +
      this.sourceAddress +
      ",\n" +
      "rate: " +
      this.rate.toString() +
      ",\n" +
      "balance: " +
      this.balance.toString() +
      ",\n" +
      "value: " +
      this.getValue().toString() +
      "\n" +
      "}\n"
    );
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

  constructor(records: TokenRecord[]) {
    this.records = records;
  }

  push(element: TokenRecord): void {
    this.records.push(element);
  }

  combine(array: TokenRecord[]): void {
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
    // NOTE: asc spits a TS2304 error with the callback function if using `reduce`
    let stringValue = "[";

    for (let i = 0; i < this.records.length; i++) {
      stringValue = stringValue + this.records[i].toString() + ",\n";
    }

    stringValue = stringValue + "]";

    return stringValue;
  }
}

/**
 * Represents balances of different tokens.
 *
 * e.g.
 * DAI:
 * - treasury wallet v1,
 * - treasury wallet v2
 *
 * FEI:
 * - treasury wallet v1,
 * - treasury wallet v2
 */
export class TokensRecords {
  // TODO shift this back to Map. Has issues with current version of graph-ts.
  tokens: Array<TokenRecords>;

  constructor() {
    this.tokens = new Array<TokenRecords>();
  }

  addToken(token: string, records: TokenRecords): void {
    this.tokens.push(records);
  }

  getValue(): BigDecimal {
    // NOTE: asc spits a TS2304 error with the callback function if using `reduce`
    let value = BigDecimal.fromString("0");

    for (let i = 0; i < this.tokens.length; i++) {
      const currentValue: TokenRecords = this.tokens[i];
      value = value.plus(currentValue.getValue());
    }

    return value;
  }

  /**
   * Returns a string representation in a JSON format.
   *
   * e.g.
   * {
   *    "DAI": TokenRecords.toString()
   * }
   * @returns
   */
  toString(): string {
    // NOTE: asc spits a TS2304 error with the callback function if using `reduce`
    let stringValue = "{";

    for (let i = 0; i < this.tokens.length; i++) {
      stringValue = stringValue + "\n" + this.tokens[i].toString();
      stringValue = stringValue + "\n,";
    }

    stringValue = stringValue + "}";

    return stringValue;
  }
}
