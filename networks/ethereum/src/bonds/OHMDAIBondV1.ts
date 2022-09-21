import { toDecimal } from "../../../shared/src/utils/Decimals";
import { DepositBondPrincipleCall } from "../../generated/OHMDAIBondV1/OHMDAIBondV1";
import { createDailyBondRecord } from "../bonds/DailyBond";
import { getOhmUSDPairValue } from "../liquidity/LiquidityUniswapV2";
import { OHMDAILPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_DAI } from "../utils/Constants";
import { loadOrCreateToken } from "../utils/Tokens";

export function handleDeposit(call: DepositBondPrincipleCall): void {
  const token = loadOrCreateToken(OHMDAILPBOND_TOKEN);
  const amount = toDecimal(call.inputs.amountToDeposit_, 18);

  createDailyBondRecord(
    call.block.timestamp,
    token,
    amount,
    getOhmUSDPairValue(call.inputs.amountToDeposit_, PAIR_UNISWAP_V2_OHM_DAI, call.block.number),
  );
}
