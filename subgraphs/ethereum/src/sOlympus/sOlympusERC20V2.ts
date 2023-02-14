import { Address, BigInt } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../../shared/src/utils/Decimals";
import { Rebase } from "../../generated/schema";
import { OlympusERC20 } from "../../generated/sOlympusERC20V2/OlympusERC20";
import { RebaseCall } from "../../generated/sOlympusERC20V2/sOlympusERC20V2";
import { ERC20_OHM_V1, ERC20_OHM_V2, STAKING_CONTRACT_V2 } from "../utils/Constants";
import { createDailyStakingReward } from "../utils/DailyStakingReward";
import { getUSDRate } from "../utils/Price";

export function rebaseFunction(call: RebaseCall): void {
  let rebase = Rebase.load(call.block.timestamp.toString());

  if (rebase == null && call.inputs.profit_.gt(BigInt.fromI32(0))) {
    const ohm_contract = OlympusERC20.bind(Address.fromString(ERC20_OHM_V1));

    rebase = new Rebase(call.block.timestamp.toString());
    rebase.amount = toDecimal(call.inputs.profit_, 9);
    rebase.stakedOhms = toDecimal(
      ohm_contract.balanceOf(Address.fromString(STAKING_CONTRACT_V2)),
      9,
    );
    rebase.contract = STAKING_CONTRACT_V2;
    rebase.percentage = rebase.amount.div(rebase.stakedOhms);
    rebase.timestamp = call.block.timestamp;
    rebase.value = rebase.amount.times(getUSDRate(ERC20_OHM_V2, call.block.number));
    rebase.save();

    createDailyStakingReward(rebase.timestamp, rebase.amount, call.block.number);
  }
}
