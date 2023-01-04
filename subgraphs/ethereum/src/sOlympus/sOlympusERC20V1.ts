import { Address, BigInt } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../../../common/src/utils/Decimals";
import { Rebase } from "../../generated/schema";
import { OlympusERC20 } from "../../generated/sOlympusERC20V1/OlympusERC20";
import { RebaseCall } from "../../generated/sOlympusERC20V1/sOlympusERC20";
import { ERC20_OHM_V1, STAKING_CONTRACT_V1 } from "../utils/Constants";
import { createDailyStakingReward } from "../utils/DailyStakingReward";
import { getBaseOhmUsdRate } from "../utils/Price";

export function rebaseFunction(call: RebaseCall): void {
  let rebase = Rebase.load(call.block.timestamp.toString());

  if (rebase == null && call.inputs.olyProfit.gt(BigInt.fromI32(0))) {
    const ohm_contract = OlympusERC20.bind(Address.fromString(ERC20_OHM_V1));

    rebase = new Rebase(call.block.timestamp.toString());
    rebase.amount = toDecimal(call.inputs.olyProfit, 9);
    rebase.stakedOhms = toDecimal(
      ohm_contract.balanceOf(Address.fromString(STAKING_CONTRACT_V1)),
      9,
    );
    rebase.contract = STAKING_CONTRACT_V1;
    rebase.percentage = rebase.amount.div(rebase.stakedOhms);
    rebase.timestamp = call.block.timestamp;
    rebase.value = rebase.amount.times(getBaseOhmUsdRate(call.block.number));
    rebase.save();

    createDailyStakingReward(rebase.timestamp, rebase.amount, call.block.number);
  }
}
