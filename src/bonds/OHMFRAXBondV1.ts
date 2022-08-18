import { DepositCall } from "../../generated/OHMFRAXBondV1/OHMFRAXBondV1";
import { createDailyBondRecord } from "../bonds/DailyBond";
import { getOhmUSDPairValue } from "../liquidity/LiquidityUniswapV2";
import { OHMFRAXLPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_FRAX } from "../utils/Constants";
import { toDecimal } from "../utils/Decimals";
import { loadOrCreateToken } from "../utils/Tokens";

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
