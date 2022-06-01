export class PairHandler {
  protected handler: string;
  protected pair: string;

  constructor(handler: string, pair: string) {
    this.handler = handler;
    this.pair = pair;
  }

  getHandler(): string {
    return this.handler;
  }

  getPair(): string {
    return this.pair;
  }
}
