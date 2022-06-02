// eslint-disable-next-line no-shadow
export const enum PairHandlerTypes {
  UniswapV2,
  UniswapV3,
}

/**
 * Represents a mapping between a liquidity pool's handler
 * (e.g. UniswapV2Pair) and the contract address.
 *
 * @module PairHandler
 */
export class PairHandler {
  protected handler: PairHandlerTypes;
  protected pair: string;

  /**
   * Creates a new mapping.
   *
   * @constructor
   * @param handler The type of the liquidity pair
   * @param pair The liquidity pair address
   */
  constructor(handler: PairHandlerTypes, pair: string) {
    this.handler = handler;
    this.pair = pair;
  }

  getHandler(): PairHandlerTypes {
    return this.handler;
  }

  getPair(): string {
    return this.pair;
  }
}
