// eslint-disable-next-line no-shadow
export const enum PairHandlerTypes {
  UniswapV2,
  UniswapV3,
  Curve,
  Balancer,
  FraxSwap,
  ERC4626,
}

/**
 * Represents a mapping between a liquidity pool's handler
 * (e.g. UniswapV2Pair) and the contract address.
 *
 * @module PairHandler
 */
export class PairHandler {
  protected type: PairHandlerTypes;
  protected contract: string;
  protected pool: string | null;

  /**
   * Creates a new mapping.
   *
   * @constructor
   * @param type The type of the liquidity pair
   * @param contract The liquidity pair/vault address
   */
  constructor(type: PairHandlerTypes, contract: string, pool: string | null = null) {
    this.type = type;
    this.contract = contract;
    this.pool = pool;
  }

  getType(): PairHandlerTypes {
    return this.type;
  }

  getContract(): string {
    return this.contract;
  }

  getPool(): string | null {
    return this.pool;
  }
}
