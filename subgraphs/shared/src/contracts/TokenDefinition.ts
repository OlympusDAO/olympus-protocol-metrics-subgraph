import { BigDecimal } from "@graphprotocol/graph-ts";

export const TokenCategoryStable = "Stable";
export const TokenCategoryVolatile = "Volatile";
export const TokenCategoryPOL = "Protocol-Owned Liquidity";

export class TokenDefinition {
  protected address: string;
  protected category: string;
  protected isLiquid: boolean;
  protected isVolatileBluechip: boolean;
  protected liquidBackingMultiplier: BigDecimal | null;
  protected isLiability: boolean;

  /**
   * Creates a new token definition.
   *
   * @constructor
   * @param address
   * @param category
   * @param isLiquid
   * @param isVolatileBluechip
   * @param liquidBackingMultiplier Multiplier applied to valueExcludingOhm (must be >= 0)
   * @param isLiability If true, both value and valueExcludingOhm will be negative
   */
  constructor(
    address: string,
    category: string,
    isLiquid: boolean,
    isVolatileBluechip: boolean,
    liquidBackingMultiplier: BigDecimal | null = null,
    isLiability: boolean = false,
  ) {
    assert(
      liquidBackingMultiplier === null || liquidBackingMultiplier.ge(BigDecimal.fromString("0")),
      "liquidBackingMultiplier must be >= 0",
    );
    this.address = address.toLowerCase();
    this.category = category;
    this.isLiquid = isLiquid;
    this.isVolatileBluechip = isVolatileBluechip;
    this.liquidBackingMultiplier = liquidBackingMultiplier;
    this.isLiability = isLiability;
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

  getLiquidBackingMultiplier(): BigDecimal | null {
    return this.liquidBackingMultiplier;
  }

  getIsLiability(): boolean {
    return this.isLiability;
  }
}
