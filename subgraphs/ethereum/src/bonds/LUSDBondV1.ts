import { toDecimal } from "../../../shared/src/utils/Decimals";
import { DepositCall } from "../../generated/LUSDBondV1/LUSDBondV1";
import { LUSDBOND_TOKEN } from "../utils/Constants";
import { loadOrCreateToken } from "../utils/Tokens";
import { createDailyBondRecord } from "./DailyBond";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(LUSDBOND_TOKEN);
  const amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(call.block.timestamp, token, amount, amount);
}
