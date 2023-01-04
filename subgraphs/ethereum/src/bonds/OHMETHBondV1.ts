import { toDecimal } from "../../../../common/src/utils/Decimals";
import { DepositCall } from "../../generated/OHMDAIBondV4/OHMDAIBondV4";
import { createDailyBondRecord } from "./DailyBond";
import { getOhmUSDPairValue } from "../liquidity/LiquidityUniswapV2";
import { OHMETHLPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_ETH } from "../utils/Constants";
import { loadOrCreateToken } from "../utils/Tokens";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(OHMETHLPBOND_TOKEN);
  const amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(
    call.block.timestamp,
    token,
    amount,
    getOhmUSDPairValue(call.inputs._amount, PAIR_UNISWAP_V2_OHM_ETH, call.block.number),
  );
}
