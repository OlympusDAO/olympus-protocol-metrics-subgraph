import BigNumber from "bignumber.js";

// Local precision avoids altering the application's global BigNumber settings.
const Decimal = BigNumber.clone({ POW_PRECISION: 60, DECIMAL_PLACES: 80 });
const MIN_TICK = -887272n;
const MAX_TICK = 887272n;

/** Validate the full observation window before issuing an RPC read. */
export function validateTwapConfig(seconds: number, spotWarningBps: number): void {
  if (
    !Number.isInteger(seconds) ||
    seconds <= 0 ||
    seconds > 0xffffffff ||
    !Number.isInteger(spotWarningBps) ||
    spotWarningBps <= 0 ||
    spotWarningBps > 10000
  ) {
    throw new Error("Invalid UniV3 TWAP configuration");
  }
}

/** Return raw token1/token0 TWAP and diagnostic spot deviation, not a spot fallback. */
export function quoteTwap(
  observation: { tickDelta: string; liquidityDelta: string; sqrtPriceX96: string },
  seconds: number,
): { raw: BigNumber; deviationBps: BigNumber } {
  if (!Number.isInteger(seconds) || seconds <= 0 || seconds > 0xffffffff) {
    throw new Error("Invalid UniV3 TWAP window");
  }
  const delta = BigInt(observation.tickDelta);
  const window = BigInt(seconds);
  let tick = delta / window;
  // Match OracleLibrary.consult: negative fractional mean ticks round down.
  if (delta < 0n && delta % window !== 0n) tick -= 1n;
  if (
    tick < MIN_TICK ||
    tick > MAX_TICK ||
    BigInt(observation.liquidityDelta) <= 0n ||
    BigInt(observation.sqrtPriceX96) <= 0n
  ) {
    throw new Error("Invalid UniV3 TWAP observation");
  }
  const raw = new BigNumber(new Decimal("1.0001").pow(Number(tick)).toString());
  const spot = new BigNumber(observation.sqrtPriceX96).pow(2).div(new BigNumber(2).pow(192));
  return { raw, deviationBps: spot.div(raw).minus(1).abs().times(10000) };
}
