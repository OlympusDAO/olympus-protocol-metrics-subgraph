import { DepositCall } from "../generated/DAIBondV1/DAIBondV1";
import { createDailyBondRecord } from "./bonds/DailyBond";
import { DAIBOND_TOKEN } from "./utils/Constants";
import { toDecimal } from "./utils/Decimals";
import { loadOrCreateToken } from "./utils/Tokens";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(DAIBOND_TOKEN);
  const amount = toDecimal(call.inputs.amount_, 18);

  createDailyBondRecord(call.block.timestamp, token, amount, amount);
}
