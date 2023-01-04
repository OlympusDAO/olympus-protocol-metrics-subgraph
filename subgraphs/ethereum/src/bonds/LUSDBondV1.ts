import { toDecimal } from "../../../../common/src/utils/Decimals";
import { DepositCall } from "../../generated/LUSDBondV1/LUSDBondV1";
import { createDailyBondRecord } from "./DailyBond";
import { LUSDBOND_TOKEN } from "../utils/Constants";
import { loadOrCreateToken } from "../utils/Tokens";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(LUSDBOND_TOKEN);
  const amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(call.block.timestamp, token, amount, amount);
}