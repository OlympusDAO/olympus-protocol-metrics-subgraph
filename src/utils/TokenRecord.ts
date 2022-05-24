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

  getBalance(): BigDecimal {
    return this.records.reduce((accumulator, obj, _currentIndex, _array) => {
      return accumulator.plus(obj.balance);
    }, BigDecimal.fromString("0"));
  }

  getValue(): BigDecimal {
    return this.records.reduce((accumulator, obj, _currentIndex, _array) => {
      return accumulator.plus(obj.getValue());
    }, BigDecimal.fromString("0"));
  }

  toString(): string {
    return this.records.reduce((previousValue, currentValue, _currentIndex, _array) => {
      return previousValue + "\n" + currentValue.toString();
    }, "");
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
    return this.tokens.reduce((previousValue, currentValue, _currentIndex, _array) => {
      return previousValue.plus(currentValue.getValue());
    }, BigDecimal.fromString("0"));
  }

  toString(): string {
    return this.tokens.reduce((previousValue, currentValue, _currentIndex, _array) => {
      return previousValue + "\n" + currentValue.toString();
    }, "");
  }
}
