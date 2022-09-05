import { toDecimal } from "../../../shared/src/utils/Decimals";
import { DepositCall } from "../../generated/OHMDAIBondV4/OHMDAIBondV4";
import { createDailyBondRecord } from "../bonds/DailyBond";
import { getOhmUSDPairValue } from "../liquidity/LiquidityUniswapV2";
import { OHMLUSDLPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_LUSD } from "../utils/Constants";
import { loadOrCreateToken } from "../utils/Tokens";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(OHMLUSDLPBOND_TOKEN);
  const amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(
    call.block.timestamp,
    token,
    amount,
    getOhmUSDPairValue(call.inputs._amount, PAIR_UNISWAP_V2_OHM_LUSD, call.block.number),
  );
}
