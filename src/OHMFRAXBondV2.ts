import { DepositCall } from "../generated/OHMFRAXBondV2/OHMFRAXBondV2";
import { OHMFRAXLPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_FRAX } from "./utils/Constants";
import { createDailyBondRecord } from "./utils/DailyBond";
import { toDecimal } from "./utils/Decimals";
import { getOhmUSDPairValue } from "./utils/LiquidityUniswapV2";
import { loadOrCreateToken } from "./utils/Tokens";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(OHMFRAXLPBOND_TOKEN);
  const amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(
    call.block.timestamp,
    token,
    amount,
    getOhmUSDPairValue(call.inputs._amount, PAIR_UNISWAP_V2_OHM_FRAX, call.block.number),
  );
}
