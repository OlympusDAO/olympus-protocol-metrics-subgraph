import { toDecimal } from "../../../shared/src/utils/Decimals";
import { DepositCall } from "../../generated/OHMDAIBondV2/OHMDAIBondV2";
import { getOhmUSDPairValue } from "../liquidity/LiquidityUniswapV2";
import { OHMDAILPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_DAI } from "../utils/Constants";
import { loadOrCreateToken } from "../utils/Tokens";
import { createDailyBondRecord } from "./DailyBond";

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
