import { DepositCall } from "../generated/OHMDAIBondV4/OHMDAIBondV4";
import { OHMETHLPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_ETH } from "./utils/Constants";
import { createDailyBondRecord } from "./bonds/DailyBond";
import { toDecimal } from "./utils/Decimals";
import { getOhmUSDPairValue } from "./utils/LiquidityUniswapV2";
import { loadOrCreateToken } from "./utils/Tokens";

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
