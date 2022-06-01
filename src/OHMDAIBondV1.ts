import { DepositBondPrincipleCall, RedeemBondCall } from "../generated/OHMDAIBondV1/OHMDAIBondV1";
import { toDecimal } from "./utils/Decimals";
import { OHMDAILPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_DAI } from "./utils/Constants";
import { loadOrCreateToken } from "./utils/Tokens";
import { createDailyBondRecord } from "./utils/DailyBond";
import { getPairUSD } from "./utils/Price";

export function handleDeposit(call: DepositBondPrincipleCall): void {
  let token = loadOrCreateToken(OHMDAILPBOND_TOKEN);
  let amount = toDecimal(call.inputs.amountToDeposit_, 18);

  createDailyBondRecord(
    call.block.timestamp,
    token,
    amount,
    getPairUSD(call.inputs.amountToDeposit_, PAIR_UNISWAP_V2_OHM_DAI, call.block.number),
  );
}
