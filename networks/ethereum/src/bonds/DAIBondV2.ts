import { toDecimal } from "../../../shared/src/utils/Decimals";
import { DepositCall } from "../../generated/DAIBondV2/DAIBondV2";
import { createDailyBondRecord } from "../bonds/DailyBond";
import { DAIBOND_TOKEN } from "../utils/Constants";
import { loadOrCreateToken } from "../utils/Tokens";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(DAIBOND_TOKEN);
  const amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(call.block.timestamp, token, amount, amount);
}
