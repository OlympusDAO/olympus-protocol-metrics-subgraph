import { DepositCall } from "../generated/OHMDAIBondV4/OHMDAIBondV4";
import { toDecimal } from "./utils/Decimals";
import { OHMETHLPBOND_TOKEN, PAIR_UNISWAP_V2_OHM_ETH } from "./utils/Constants";
import { loadOrCreateToken } from "./utils/Tokens";
import { createDailyBondRecord } from "./utils/DailyBond";
import { getPairUSD } from "./utils/Price";

export function handleDeposit(call: DepositCall): void {
  let token = loadOrCreateToken(OHMETHLPBOND_TOKEN);
  let amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(
    call.block.timestamp,
    token,
    amount,
    getPairUSD(call.inputs._amount, PAIR_UNISWAP_V2_OHM_ETH, call.block.number),
  );
}
