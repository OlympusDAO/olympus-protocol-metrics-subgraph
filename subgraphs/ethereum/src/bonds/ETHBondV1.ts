import { toDecimal } from "../../../shared/src/utils/Decimals";
import { DepositCall } from "../../generated/FRAXBondV1/FRAXBondV1";
import { ETHBOND_TOKEN } from "../utils/Constants";
import { getBaseEthUsdRate } from "../utils/PriceBase";
import { loadOrCreateToken } from "../utils/Tokens";
import { createDailyBondRecord } from "./DailyBond";

export function handleDeposit(call: DepositCall): void {
  const token = loadOrCreateToken(ETHBOND_TOKEN);
  const amount = toDecimal(call.inputs._amount, 18);

  createDailyBondRecord(call.block.timestamp, token, amount, amount.times(getBaseEthUsdRate()));
}
