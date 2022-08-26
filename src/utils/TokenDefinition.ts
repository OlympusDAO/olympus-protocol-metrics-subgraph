export const TokenCategoryStable = "Stable";
export const TokenCategoryVolatile = "Volatile";
export const TokenCategoryPOL = "Protocol-Owned Liquidity";

export class TokenDefinition {
  protected address: string;
  protected category: string;
  protected isLiquid: boolean;
  protected isVolatileBluechip: boolean;

  /**
   * Creates a new token definition.
   *
   * @constructor
   * @param address
   * @param category
   * @param isLiquid
   * @param isVolatileBluechip
   */
  constructor(address: string, category: string, isLiquid: boolean, isVolatileBluechip: boolean) {
    this.address = address.toLowerCase();
    this.category = category;
    this.isLiquid = isLiquid;
    this.isVolatileBluechip = isVolatileBluechip;
  }

  getAddress(): string {
    return this.address;
  }

  getCategory(): string {
    return this.category;
  }

  getIsLiquid(): boolean {
    return this.isLiquid;
  }

  getIsVolatileBluechip(): boolean {
    return this.isVolatileBluechip;
  }
}
