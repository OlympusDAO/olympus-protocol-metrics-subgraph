// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  Address,
  BigInt,
  Bytes,
  Entity,
  ethereum,
  JSONValue,
  TypedMap} from "@graphprotocol/graph-ts";

export class RewardAdded extends ethereum.Event {
  get params(): RewardAdded__Params {
    return new RewardAdded__Params(this);
  }
}

export class RewardAdded__Params {
  _event: RewardAdded;

  constructor(event: RewardAdded) {
    this._event = event;
  }

  get reward(): BigInt {
    return this._event.parameters[0].value.toBigInt();
  }
}

export class RewardPaid extends ethereum.Event {
  get params(): RewardPaid__Params {
    return new RewardPaid__Params(this);
  }
}

export class RewardPaid__Params {
  _event: RewardPaid;

  constructor(event: RewardPaid) {
    this._event = event;
  }

  get user(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get reward(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }
}

export class Staked extends ethereum.Event {
  get params(): Staked__Params {
    return new Staked__Params(this);
  }
}

export class Staked__Params {
  _event: Staked;

  constructor(event: Staked) {
    this._event = event;
  }

  get user(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get amount(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }
}

export class Withdrawn extends ethereum.Event {
  get params(): Withdrawn__Params {
    return new Withdrawn__Params(this);
  }
}

export class Withdrawn__Params {
  _event: Withdrawn;

  constructor(event: Withdrawn) {
    this._event = event;
  }

  get user(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get amount(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }
}

export class AuraVirtualBalanceRewardPool extends ethereum.SmartContract {
  static bind(address: Address): AuraVirtualBalanceRewardPool {
    return new AuraVirtualBalanceRewardPool(
      "AuraVirtualBalanceRewardPool",
      address
    );
  }

  balanceOf(account: Address): BigInt {
    const result = super.call("balanceOf", "balanceOf(address):(uint256)", [
      ethereum.Value.fromAddress(account)
    ]);

    return result[0].toBigInt();
  }

  try_balanceOf(account: Address): ethereum.CallResult<BigInt> {
    const result = super.tryCall("balanceOf", "balanceOf(address):(uint256)", [
      ethereum.Value.fromAddress(account)
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  currentRewards(): BigInt {
    const result = super.call("currentRewards", "currentRewards():(uint256)", []);

    return result[0].toBigInt();
  }

  try_currentRewards(): ethereum.CallResult<BigInt> {
    const result = super.tryCall(
      "currentRewards",
      "currentRewards():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  deposits(): Address {
    const result = super.call("deposits", "deposits():(address)", []);

    return result[0].toAddress();
  }

  try_deposits(): ethereum.CallResult<Address> {
    const result = super.tryCall("deposits", "deposits():(address)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  donate(_amount: BigInt): boolean {
    const result = super.call("donate", "donate(uint256):(bool)", [
      ethereum.Value.fromUnsignedBigInt(_amount)
    ]);

    return result[0].toBoolean();
  }

  try_donate(_amount: BigInt): ethereum.CallResult<boolean> {
    const result = super.tryCall("donate", "donate(uint256):(bool)", [
      ethereum.Value.fromUnsignedBigInt(_amount)
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBoolean());
  }

  duration(): BigInt {
    const result = super.call("duration", "duration():(uint256)", []);

    return result[0].toBigInt();
  }

  try_duration(): ethereum.CallResult<BigInt> {
    const result = super.tryCall("duration", "duration():(uint256)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  earned(account: Address): BigInt {
    const result = super.call("earned", "earned(address):(uint256)", [
      ethereum.Value.fromAddress(account)
    ]);

    return result[0].toBigInt();
  }

  try_earned(account: Address): ethereum.CallResult<BigInt> {
    const result = super.tryCall("earned", "earned(address):(uint256)", [
      ethereum.Value.fromAddress(account)
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  historicalRewards(): BigInt {
    const result = super.call(
      "historicalRewards",
      "historicalRewards():(uint256)",
      []
    );

    return result[0].toBigInt();
  }

  try_historicalRewards(): ethereum.CallResult<BigInt> {
    const result = super.tryCall(
      "historicalRewards",
      "historicalRewards():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  lastTimeRewardApplicable(): BigInt {
    const result = super.call(
      "lastTimeRewardApplicable",
      "lastTimeRewardApplicable():(uint256)",
      []
    );

    return result[0].toBigInt();
  }

  try_lastTimeRewardApplicable(): ethereum.CallResult<BigInt> {
    const result = super.tryCall(
      "lastTimeRewardApplicable",
      "lastTimeRewardApplicable():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  lastUpdateTime(): BigInt {
    const result = super.call("lastUpdateTime", "lastUpdateTime():(uint256)", []);

    return result[0].toBigInt();
  }

  try_lastUpdateTime(): ethereum.CallResult<BigInt> {
    const result = super.tryCall(
      "lastUpdateTime",
      "lastUpdateTime():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  newRewardRatio(): BigInt {
    const result = super.call("newRewardRatio", "newRewardRatio():(uint256)", []);

    return result[0].toBigInt();
  }

  try_newRewardRatio(): ethereum.CallResult<BigInt> {
    const result = super.tryCall(
      "newRewardRatio",
      "newRewardRatio():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  operator(): Address {
    const result = super.call("operator", "operator():(address)", []);

    return result[0].toAddress();
  }

  try_operator(): ethereum.CallResult<Address> {
    const result = super.tryCall("operator", "operator():(address)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  periodFinish(): BigInt {
    const result = super.call("periodFinish", "periodFinish():(uint256)", []);

    return result[0].toBigInt();
  }

  try_periodFinish(): ethereum.CallResult<BigInt> {
    const result = super.tryCall("periodFinish", "periodFinish():(uint256)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  queuedRewards(): BigInt {
    const result = super.call("queuedRewards", "queuedRewards():(uint256)", []);

    return result[0].toBigInt();
  }

  try_queuedRewards(): ethereum.CallResult<BigInt> {
    const result = super.tryCall(
      "queuedRewards",
      "queuedRewards():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  rewardPerToken(): BigInt {
    const result = super.call("rewardPerToken", "rewardPerToken():(uint256)", []);

    return result[0].toBigInt();
  }

  try_rewardPerToken(): ethereum.CallResult<BigInt> {
    const result = super.tryCall(
      "rewardPerToken",
      "rewardPerToken():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  rewardPerTokenStored(): BigInt {
    const result = super.call(
      "rewardPerTokenStored",
      "rewardPerTokenStored():(uint256)",
      []
    );

    return result[0].toBigInt();
  }

  try_rewardPerTokenStored(): ethereum.CallResult<BigInt> {
    const result = super.tryCall(
      "rewardPerTokenStored",
      "rewardPerTokenStored():(uint256)",
      []
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  rewardRate(): BigInt {
    const result = super.call("rewardRate", "rewardRate():(uint256)", []);

    return result[0].toBigInt();
  }

  try_rewardRate(): ethereum.CallResult<BigInt> {
    const result = super.tryCall("rewardRate", "rewardRate():(uint256)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  rewardToken(): Address {
    const result = super.call("rewardToken", "rewardToken():(address)", []);

    return result[0].toAddress();
  }

  try_rewardToken(): ethereum.CallResult<Address> {
    const result = super.tryCall("rewardToken", "rewardToken():(address)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  rewards(param0: Address): BigInt {
    const result = super.call("rewards", "rewards(address):(uint256)", [
      ethereum.Value.fromAddress(param0)
    ]);

    return result[0].toBigInt();
  }

  try_rewards(param0: Address): ethereum.CallResult<BigInt> {
    const result = super.tryCall("rewards", "rewards(address):(uint256)", [
      ethereum.Value.fromAddress(param0)
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  totalSupply(): BigInt {
    const result = super.call("totalSupply", "totalSupply():(uint256)", []);

    return result[0].toBigInt();
  }

  try_totalSupply(): ethereum.CallResult<BigInt> {
    const result = super.tryCall("totalSupply", "totalSupply():(uint256)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  userRewardPerTokenPaid(param0: Address): BigInt {
    const result = super.call(
      "userRewardPerTokenPaid",
      "userRewardPerTokenPaid(address):(uint256)",
      [ethereum.Value.fromAddress(param0)]
    );

    return result[0].toBigInt();
  }

  try_userRewardPerTokenPaid(param0: Address): ethereum.CallResult<BigInt> {
    const result = super.tryCall(
      "userRewardPerTokenPaid",
      "userRewardPerTokenPaid(address):(uint256)",
      [ethereum.Value.fromAddress(param0)]
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }
}

export class ConstructorCall extends ethereum.Call {
  get inputs(): ConstructorCall__Inputs {
    return new ConstructorCall__Inputs(this);
  }

  get outputs(): ConstructorCall__Outputs {
    return new ConstructorCall__Outputs(this);
  }
}

export class ConstructorCall__Inputs {
  _call: ConstructorCall;

  constructor(call: ConstructorCall) {
    this._call = call;
  }

  get deposit_(): Address {
    return this._call.inputValues[0].value.toAddress();
  }

  get reward_(): Address {
    return this._call.inputValues[1].value.toAddress();
  }

  get op_(): Address {
    return this._call.inputValues[2].value.toAddress();
  }
}

export class ConstructorCall__Outputs {
  _call: ConstructorCall;

  constructor(call: ConstructorCall) {
    this._call = call;
  }
}

export class DonateCall extends ethereum.Call {
  get inputs(): DonateCall__Inputs {
    return new DonateCall__Inputs(this);
  }

  get outputs(): DonateCall__Outputs {
    return new DonateCall__Outputs(this);
  }
}

export class DonateCall__Inputs {
  _call: DonateCall;

  constructor(call: DonateCall) {
    this._call = call;
  }

  get _amount(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }
}

export class DonateCall__Outputs {
  _call: DonateCall;

  constructor(call: DonateCall) {
    this._call = call;
  }

  get value0(): boolean {
    return this._call.outputValues[0].value.toBoolean();
  }
}

export class GetRewardCall extends ethereum.Call {
  get inputs(): GetRewardCall__Inputs {
    return new GetRewardCall__Inputs(this);
  }

  get outputs(): GetRewardCall__Outputs {
    return new GetRewardCall__Outputs(this);
  }
}

export class GetRewardCall__Inputs {
  _call: GetRewardCall;

  constructor(call: GetRewardCall) {
    this._call = call;
  }
}

export class GetRewardCall__Outputs {
  _call: GetRewardCall;

  constructor(call: GetRewardCall) {
    this._call = call;
  }
}

export class GetReward1Call extends ethereum.Call {
  get inputs(): GetReward1Call__Inputs {
    return new GetReward1Call__Inputs(this);
  }

  get outputs(): GetReward1Call__Outputs {
    return new GetReward1Call__Outputs(this);
  }
}

export class GetReward1Call__Inputs {
  _call: GetReward1Call;

  constructor(call: GetReward1Call) {
    this._call = call;
  }

  get _account(): Address {
    return this._call.inputValues[0].value.toAddress();
  }
}

export class GetReward1Call__Outputs {
  _call: GetReward1Call;

  constructor(call: GetReward1Call) {
    this._call = call;
  }
}

export class QueueNewRewardsCall extends ethereum.Call {
  get inputs(): QueueNewRewardsCall__Inputs {
    return new QueueNewRewardsCall__Inputs(this);
  }

  get outputs(): QueueNewRewardsCall__Outputs {
    return new QueueNewRewardsCall__Outputs(this);
  }
}

export class QueueNewRewardsCall__Inputs {
  _call: QueueNewRewardsCall;

  constructor(call: QueueNewRewardsCall) {
    this._call = call;
  }

  get _rewards(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }
}

export class QueueNewRewardsCall__Outputs {
  _call: QueueNewRewardsCall;

  constructor(call: QueueNewRewardsCall) {
    this._call = call;
  }
}

export class StakeCall extends ethereum.Call {
  get inputs(): StakeCall__Inputs {
    return new StakeCall__Inputs(this);
  }

  get outputs(): StakeCall__Outputs {
    return new StakeCall__Outputs(this);
  }
}

export class StakeCall__Inputs {
  _call: StakeCall;

  constructor(call: StakeCall) {
    this._call = call;
  }

  get _account(): Address {
    return this._call.inputValues[0].value.toAddress();
  }

  get amount(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }
}

export class StakeCall__Outputs {
  _call: StakeCall;

  constructor(call: StakeCall) {
    this._call = call;
  }
}

export class WithdrawCall extends ethereum.Call {
  get inputs(): WithdrawCall__Inputs {
    return new WithdrawCall__Inputs(this);
  }

  get outputs(): WithdrawCall__Outputs {
    return new WithdrawCall__Outputs(this);
  }
}

export class WithdrawCall__Inputs {
  _call: WithdrawCall;

  constructor(call: WithdrawCall) {
    this._call = call;
  }

  get _account(): Address {
    return this._call.inputValues[0].value.toAddress();
  }

  get amount(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }
}

export class WithdrawCall__Outputs {
  _call: WithdrawCall;

  constructor(call: WithdrawCall) {
    this._call = call;
  }
}
