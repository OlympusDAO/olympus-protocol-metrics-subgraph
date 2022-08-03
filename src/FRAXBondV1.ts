import { DepositCall } from "../generated/FRAXBondV1/FRAXBondV1";
import { createDailyBondRecord } from "./bonds/DailyBond";
import { FRAXBOND_TOKEN } from "./utils/Constants";
import { toDecimal } from "./utils/Decimals";
import { loadOrCreateToken } from "./utils/Tokens";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(FRAXBOND_TOKEN);
  const amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(call.block.timestamp, token, amount, amount);
}
