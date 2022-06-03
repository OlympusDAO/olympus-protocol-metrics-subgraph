import { DepositCall } from "../generated/OHMDAIBondV4/OHMDAIBondV4";
import { toDecimal } from "./utils/Decimals";
import { OHMLUSDLPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_LUSD } from "./utils/Constants";
import { loadOrCreateToken } from "./utils/Tokens";
import { createDailyBondRecord } from "./utils/DailyBond";
import { getOhmUSDPairValue } from "./utils/Price";

export function handleDeposit(call: DepositCall): void {
  let token = loadOrCreateToken(OHMLUSDLPBOND_TOKEN);
  let amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(
    call.block.timestamp,
    token,
    amount,
    getOhmUSDPairValue(call.inputs._amount, PAIR_UNISWAP_V2_OHM_LUSD, call.block.number),
  );
}
