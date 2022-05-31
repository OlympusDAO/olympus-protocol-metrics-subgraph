import { BigDecimal, log } from "@graphprotocol/graph-ts";
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
  multiplier: BigDecimal;

  constructor(
    name: string,
    source: string,
    sourceAddress: string,
    rate: BigDecimal,
    balance: BigDecimal,
    multiplier: BigDecimal = BigDecimal.fromString("1"),
  ) {
    this.name = name;
    this.source = source;
    this.sourceAddress = sourceAddress;
    this.rate = rate;
    this.balance = balance;
    this.multiplier = multiplier;
  }

  setMultiplier(multiplier: BigDecimal): void {
    this.multiplier = multiplier;
  }

  /**
   * Returns the value of the TokenRecord, defined as:
   *
   * {rate} * {balance} * {multiplier}
   *
   * @returns BigDecimal
   */
  getValue(): BigDecimal {
    return this.balance.times(this.rate).times(this.multiplier);
  }

  /**
   * Returns an ID representing the TokenRecord, defined by:
   * - name
   * - source
   *
   * This can be used to uniquely identify a record in
   * order to avoid duplicates.
   *
   * @returns string
   */
  getId(): string {
    return this.name + "-" + this.source;
  }

  /**
   * Returns a JSON-like dictionary in string format.
   *
   * @returns string
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
    encoder.setString("multiplier", this.multiplier.toString());
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
  records: Map<string, TokenRecord>;

  constructor() {
    this.records = new Map<string, TokenRecord>();
  }

  /**
   * Adds the given TokenRecord to the group.
   *
   * If there is an existing TokenRecord with the same ID,
   * it will be replaced.
   *
   * @param element TokenRecord to add
   */
  push(element: TokenRecord): void {
    if (this.records.has(element.getId())) {
      log.warning("Existing record being replaced: {}", [element.getId()]);
    }

    this.records.set(element.getId(), element);
  }

  /**
   * Combines a TokenRecords object with the recipient.
   *
   * As with {push}, any existing TokenRecord objects with
   * the same ID will be replaced.
   *
   * @param records TokenRecords to add
   */
  combine(records: TokenRecords): void {
    const inRecordsMap = records.records;

    for (let i = 0; i < inRecordsMap.keys().length; i++) {
      const currentKey: string = inRecordsMap.keys()[i];
      const currentValue: TokenRecord = inRecordsMap.get(currentKey);

      this.push(currentValue);
    }
  }

  /**
   * Applies the given multiplier to all child TokenRecord objects.
   *
   * @param multiplier the multiplier to apply
   */
  setMultiplier(multiplier: BigDecimal): void {
    for (let i = 0; i < this.records.values().length; i++) {
      const currentValue: TokenRecord = this.records.values()[i];
      currentValue.setMultiplier(multiplier);
    }
  }

  getBalance(): BigDecimal {
    // NOTE: asc spits a TS2304 error with the callback function if using `reduce`
    let balance = BigDecimal.fromString("0");
    const values = this.records.values();

    for (let i = 0; i < values.length; i++) {
      balance = balance.plus(values[i].balance);
    }

    return balance;
  }

  getValue(): BigDecimal {
    // NOTE: asc spits a TS2304 error with the callback function if using `reduce`
    let value = BigDecimal.fromString("0");
    const values = this.records.values();

    for (let i = 0; i < values.length; i++) {
      value = value.plus(values[i].getValue());
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

  protected getSortedRecords(): Array<TokenRecord> {
    return this.records.values().sort((a, b) => (a.name > b.name ? 1 : -1));
  }

  /**
   * Returns an array containing stringified output
   * of TokenRecord.
   *
   * @param singleQuote If true, replaces double quotes with single quotes,
   * so they are not subsequently escaped. Defaults to false.
   * @returns Array of string representations of TokenRecord, sorted by TokenRecord.name
   */
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  toStringArray(singleQuote: boolean = false): Array<string> {
    const array = new Array<string>();
    const sortedRecords = this.getSortedRecords();

    for (let i = 0; i < sortedRecords.length; i++) {
      let record = sortedRecords[i].toString();

      if (singleQuote) {
        record = record.replaceAll('"', "'");
      }

      array.push(record);
    }

    return array;
  }

  encode(encoder: JSONEncoder): void {
    const sortedRecords = this.getSortedRecords();

    encoder.pushObject(null);
    encoder.pushArray("records");

    for (let i = 0; i < sortedRecords.length; i++) {
      encoder.setString(null, sortedRecords[i].toString());
    }

    encoder.popArray();

    encoder.setString("balance", this.getBalance().toString());
    encoder.setString("value", this.getValue().toString());
    encoder.popObject();
  }
}
