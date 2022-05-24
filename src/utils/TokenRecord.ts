import { BigDecimal } from "@graphprotocol/graph-ts";

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
    balance: BigDecimal
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

  toString(): string {
    return `{\n` +
      `name: ${this.name},\n` +
      `source: ${this.source},\n` +
      `sourceAddress: ${ this.sourceAddress },\n` +
      `rate: ${this.rate.toString()},\n` +
      `balance: ${this.balance.toString()},` +
      `value: ${this.getValue().toString()}\n` +
    `}\n`;
  }
}

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

  toString(): string {
    // NOTE: asc spits a TS2304 error with the callback function if using `reduce`
    let stringValue = "";

    for (let i = 0; i < this.records.length; i++) {
      stringValue = stringValue + "\n" + this.records[i].toString();
    }

    return stringValue;
  }
}

export class TokensRecords {
  tokens: Array<TokenRecords>;

  construct(): void {
    this.tokens = new Array<TokenRecords>();
  }

  addToken(token: string, records: TokenRecords): void {
    this.tokens.push(records);
  }

  getValue(): BigDecimal {
    // NOTE: asc spits a TS2304 error with the callback function if using `reduce`
    let value = BigDecimal.fromString("0");

    for (let i = 0; i < this.tokens.length; i++) {
      value = value.plus(this.tokens[i].getValue());
    }

    return value;
  }

  toString(): string {
    // NOTE: asc spits a TS2304 error with the callback function if using `reduce`
    let stringValue = "";

    for (let i = 0; i < this.tokens.length; i++) {
      stringValue = stringValue + "\n" + this.tokens[i].toString();
    }

    return stringValue;
  }
}
