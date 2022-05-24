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
}

export class TokenRecords {
  records: TokenRecord[];

  constructor(records: TokenRecord[]) {
    this.records = records;
  }

  getBalance(): BigDecimal {
    return this.records.reduce((accumulator, obj) => {
      return accumulator.plus(obj.balance);
    }, BigDecimal.fromString("0"));
  }

  getValue(): BigDecimal {
    return this.records.reduce((accumulator, obj) => {
      return accumulator.plus(obj.getValue());
    }, BigDecimal.fromString("0"));
  }
}

export class TokensRecords {
  tokens: { [key: string]: TokenRecords };

  construct(): void {
    this.tokens = {};
  }

  addToken(token: string, records: TokenRecords): void {
    this.tokens[token] = records;
  }

  getValue(): BigDecimal {
    return Object.values(this.tokens).reduce((accumulator, obj) => {
      return accumulator.plus(obj.getValue());
    }, BigDecimal.fromString("0"));
  }
}
