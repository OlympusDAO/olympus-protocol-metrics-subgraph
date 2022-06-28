import { DepositCall } from "../generated/OHMDAIBondV2/OHMDAIBondV2";
import { OHMDAILPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_DAI } from "./utils/Constants";
import { createDailyBondRecord } from "./bonds/DailyBond";
import { toDecimal } from "./utils/Decimals";
import { getOhmUSDPairValue } from "./utils/LiquidityUniswapV2";
import { loadOrCreateToken } from "./utils/Tokens";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(OHMDAILPBOND_TOKEN);
  const amount = toDecimal(call.inputs.amount_, 18);

  createDailyBondRecord(
    call.block.timestamp,
    token,
    amount,
    getOhmUSDPairValue(call.inputs.amount_, PAIR_UNISWAP_V2_OHM_DAI, call.block.number),
  );
}
