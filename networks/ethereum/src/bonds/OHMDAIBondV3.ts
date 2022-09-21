import { toDecimal } from "../../../shared/src/utils/Decimals";
import { DepositCall } from "../../generated/OHMDAIBondV3/OHMDAIBondV3";
import { createDailyBondRecord } from "../bonds/DailyBond";
import { getOhmUSDPairValue } from "../liquidity/LiquidityUniswapV2";
import { OHMDAILPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_DAI } from "../utils/Constants";
import { loadOrCreateToken } from "../utils/Tokens";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(OHMDAILPBOND_TOKEN);
  const amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(
    call.block.timestamp,
    token,
    amount,
    getOhmUSDPairValue(call.inputs._amount, PAIR_UNISWAP_V2_OHM_DAI, call.block.number),
  );
}
