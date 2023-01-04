import { toDecimal } from "../../../../common/src/utils/Decimals";
import { DepositCall } from "../../generated/DAIBondV1/DAIBondV1";
import { DAIBOND_TOKEN } from "../utils/Constants";
import { loadOrCreateToken } from "../utils/Tokens";
import { createDailyBondRecord } from "./DailyBond";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(DAIBOND_TOKEN);
  const amount = toDecimal(call.inputs.amount_, 18);

  createDailyBondRecord(call.block.timestamp, token, amount, amount);
}
