import { DepositCall, RedeemCall } from "../generated/OHMFRAXBondV1/OHMFRAXBondV1";
import { toDecimal } from "./utils/Decimals";
import { OHMFRAXLPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_FRAX } from "./utils/Constants";
import { loadOrCreateToken } from "./utils/Tokens";
import { createDailyBondRecord } from "./utils/DailyBond";
import { getPairUSD } from "./utils/Price";

export function handleDeposit(call: DepositCall): void {
  let token = loadOrCreateToken(OHMFRAXLPBOND_TOKEN);
  let amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(
    call.block.timestamp,
    token,
    amount,
    getPairUSD(call.inputs._amount, PAIR_UNISWAP_V2_OHM_FRAX, call.block.number),
  );
}
