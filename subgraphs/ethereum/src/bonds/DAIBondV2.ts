import { toDecimal } from "../../../../common/src/utils/Decimals";
import { DepositCall } from "../../generated/DAIBondV2/DAIBondV2";
import { DAIBOND_TOKEN } from "../utils/Constants";
import { loadOrCreateToken } from "../utils/Tokens";
import { createDailyBondRecord } from "./DailyBond";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(DAIBOND_TOKEN);
  const amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(call.block.timestamp, token, amount, amount);
}
