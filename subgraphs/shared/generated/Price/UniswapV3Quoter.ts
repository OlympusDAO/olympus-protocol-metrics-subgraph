// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  Address,
  BigInt,
  Bytes,
  Entity,
  ethereum,
  JSONValue,
  TypedMap,
} from "@graphprotocol/graph-ts";

export class UniswapV3Quoter__quoteExactInputResult {
  value0: BigInt;
  value1: Array<BigInt>;
  value2: Array<BigInt>;
  value3: BigInt;

  constructor(
    value0: BigInt,
    value1: Array<BigInt>,
    value2: Array<BigInt>,
    value3: BigInt,
  ) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
  }

  toMap(): TypedMap<string, ethereum.Value> {
    const map = new TypedMap<string, ethereum.Value>();
    map.set("value0", ethereum.Value.fromUnsignedBigInt(this.value0));
    map.set("value1", ethereum.Value.fromUnsignedBigIntArray(this.value1));
    map.set("value2", ethereum.Value.fromUnsignedBigIntArray(this.value2));
    map.set("value3", ethereum.Value.fromUnsignedBigInt(this.value3));
    return map;
  }

  getAmountOut(): BigInt {
    return this.value0;
  }

  getSqrtPriceX96AfterList(): Array<BigInt> {
    return this.value1;
  }

  getInitializedTicksCrossedList(): Array<BigInt> {
    return this.value2;
  }

  getGasEstimate(): BigInt {
    return this.value3;
  }
}

export class UniswapV3Quoter__quoteExactInputSingleResult {
  value0: BigInt;
  value1: BigInt;
  value2: BigInt;
  value3: BigInt;

  constructor(value0: BigInt, value1: BigInt, value2: BigInt, value3: BigInt) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
  }

  toMap(): TypedMap<string, ethereum.Value> {
    const map = new TypedMap<string, ethereum.Value>();
    map.set("value0", ethereum.Value.fromUnsignedBigInt(this.value0));
    map.set("value1", ethereum.Value.fromUnsignedBigInt(this.value1));
    map.set("value2", ethereum.Value.fromUnsignedBigInt(this.value2));
    map.set("value3", ethereum.Value.fromUnsignedBigInt(this.value3));
    return map;
  }

  getAmountOut(): BigInt {
    return this.value0;
  }

  getSqrtPriceX96After(): BigInt {
    return this.value1;
  }

  getInitializedTicksCrossed(): BigInt {
    return this.value2;
  }

  getGasEstimate(): BigInt {
    return this.value3;
  }
}

export class UniswapV3Quoter__quoteExactInputSingleInputParamsStruct extends ethereum.Tuple {
  get tokenIn(): Address {
    return this[0].toAddress();
  }

  get tokenOut(): Address {
    return this[1].toAddress();
  }

  get amountIn(): BigInt {
    return this[2].toBigInt();
  }

  get fee(): i32 {
    return this[3].toI32();
  }

  get sqrtPriceLimitX96(): BigInt {
    return this[4].toBigInt();
  }
}

export class UniswapV3Quoter__quoteExactOutputResult {
  value0: BigInt;
  value1: Array<BigInt>;
  value2: Array<BigInt>;
  value3: BigInt;

  constructor(
    value0: BigInt,
    value1: Array<BigInt>,
    value2: Array<BigInt>,
    value3: BigInt,
  ) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
  }

  toMap(): TypedMap<string, ethereum.Value> {
    const map = new TypedMap<string, ethereum.Value>();
    map.set("value0", ethereum.Value.fromUnsignedBigInt(this.value0));
    map.set("value1", ethereum.Value.fromUnsignedBigIntArray(this.value1));
    map.set("value2", ethereum.Value.fromUnsignedBigIntArray(this.value2));
    map.set("value3", ethereum.Value.fromUnsignedBigInt(this.value3));
    return map;
  }

  getAmountIn(): BigInt {
    return this.value0;
  }

  getSqrtPriceX96AfterList(): Array<BigInt> {
    return this.value1;
  }

  getInitializedTicksCrossedList(): Array<BigInt> {
    return this.value2;
  }

  getGasEstimate(): BigInt {
    return this.value3;
  }
}

export class UniswapV3Quoter__quoteExactOutputSingleResult {
  value0: BigInt;
  value1: BigInt;
  value2: BigInt;
  value3: BigInt;

  constructor(value0: BigInt, value1: BigInt, value2: BigInt, value3: BigInt) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
  }

  toMap(): TypedMap<string, ethereum.Value> {
    const map = new TypedMap<string, ethereum.Value>();
    map.set("value0", ethereum.Value.fromUnsignedBigInt(this.value0));
    map.set("value1", ethereum.Value.fromUnsignedBigInt(this.value1));
    map.set("value2", ethereum.Value.fromUnsignedBigInt(this.value2));
    map.set("value3", ethereum.Value.fromUnsignedBigInt(this.value3));
    return map;
  }

  getAmountIn(): BigInt {
    return this.value0;
  }

  getSqrtPriceX96After(): BigInt {
    return this.value1;
  }

  getInitializedTicksCrossed(): BigInt {
    return this.value2;
  }

  getGasEstimate(): BigInt {
    return this.value3;
  }
}

export class UniswapV3Quoter__quoteExactOutputSingleInputParamsStruct extends ethereum.Tuple {
  get tokenIn(): Address {
    return this[0].toAddress();
  }

  get tokenOut(): Address {
    return this[1].toAddress();
  }

  get amount(): BigInt {
    return this[2].toBigInt();
  }

  get fee(): i32 {
    return this[3].toI32();
  }

  get sqrtPriceLimitX96(): BigInt {
    return this[4].toBigInt();
  }
}

export class UniswapV3Quoter extends ethereum.SmartContract {
  static bind(address: Address): UniswapV3Quoter {
    return new UniswapV3Quoter("UniswapV3Quoter", address);
  }

  WETH9(): Address {
    const result = super.call("WETH9", "WETH9():(address)", []);

    return result[0].toAddress();
  }

  try_WETH9(): ethereum.CallResult<Address> {
    const result = super.tryCall("WETH9", "WETH9():(address)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  factory(): Address {
    const result = super.call("factory", "factory():(address)", []);

    return result[0].toAddress();
  }

  try_factory(): ethereum.CallResult<Address> {
    const result = super.tryCall("factory", "factory():(address)", []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(value[0].toAddress());
  }

  quoteExactInput(
    path: Bytes,
    amountIn: BigInt,
  ): UniswapV3Quoter__quoteExactInputResult {
    const result = super.call(
      "quoteExactInput",
      "quoteExactInput(bytes,uint256):(uint256,uint160[],uint32[],uint256)",
      [
        ethereum.Value.fromBytes(path),
        ethereum.Value.fromUnsignedBigInt(amountIn),
      ],
    );

    return new UniswapV3Quoter__quoteExactInputResult(
      result[0].toBigInt(),
      result[1].toBigIntArray(),
      result[2].toBigIntArray(),
      result[3].toBigInt(),
    );
  }

  try_quoteExactInput(
    path: Bytes,
    amountIn: BigInt,
  ): ethereum.CallResult<UniswapV3Quoter__quoteExactInputResult> {
    const result = super.tryCall(
      "quoteExactInput",
      "quoteExactInput(bytes,uint256):(uint256,uint160[],uint32[],uint256)",
      [
        ethereum.Value.fromBytes(path),
        ethereum.Value.fromUnsignedBigInt(amountIn),
      ],
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(
      new UniswapV3Quoter__quoteExactInputResult(
        value[0].toBigInt(),
        value[1].toBigIntArray(),
        value[2].toBigIntArray(),
        value[3].toBigInt(),
      ),
    );
  }

  quoteExactInputSingle(
    params: UniswapV3Quoter__quoteExactInputSingleInputParamsStruct,
  ): UniswapV3Quoter__quoteExactInputSingleResult {
    const result = super.call(
      "quoteExactInputSingle",
      "quoteExactInputSingle((address,address,uint256,uint24,uint160)):(uint256,uint160,uint32,uint256)",
      [ethereum.Value.fromTuple(params)],
    );

    return new UniswapV3Quoter__quoteExactInputSingleResult(
      result[0].toBigInt(),
      result[1].toBigInt(),
      result[2].toBigInt(),
      result[3].toBigInt(),
    );
  }

  try_quoteExactInputSingle(
    params: UniswapV3Quoter__quoteExactInputSingleInputParamsStruct,
  ): ethereum.CallResult<UniswapV3Quoter__quoteExactInputSingleResult> {
    const result = super.tryCall(
      "quoteExactInputSingle",
      "quoteExactInputSingle((address,address,uint256,uint24,uint160)):(uint256,uint160,uint32,uint256)",
      [ethereum.Value.fromTuple(params)],
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(
      new UniswapV3Quoter__quoteExactInputSingleResult(
        value[0].toBigInt(),
        value[1].toBigInt(),
        value[2].toBigInt(),
        value[3].toBigInt(),
      ),
    );
  }

  quoteExactOutput(
    path: Bytes,
    amountOut: BigInt,
  ): UniswapV3Quoter__quoteExactOutputResult {
    const result = super.call(
      "quoteExactOutput",
      "quoteExactOutput(bytes,uint256):(uint256,uint160[],uint32[],uint256)",
      [
        ethereum.Value.fromBytes(path),
        ethereum.Value.fromUnsignedBigInt(amountOut),
      ],
    );

    return new UniswapV3Quoter__quoteExactOutputResult(
      result[0].toBigInt(),
      result[1].toBigIntArray(),
      result[2].toBigIntArray(),
      result[3].toBigInt(),
    );
  }

  try_quoteExactOutput(
    path: Bytes,
    amountOut: BigInt,
  ): ethereum.CallResult<UniswapV3Quoter__quoteExactOutputResult> {
    const result = super.tryCall(
      "quoteExactOutput",
      "quoteExactOutput(bytes,uint256):(uint256,uint160[],uint32[],uint256)",
      [
        ethereum.Value.fromBytes(path),
        ethereum.Value.fromUnsignedBigInt(amountOut),
      ],
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(
      new UniswapV3Quoter__quoteExactOutputResult(
        value[0].toBigInt(),
        value[1].toBigIntArray(),
        value[2].toBigIntArray(),
        value[3].toBigInt(),
      ),
    );
  }

  quoteExactOutputSingle(
    params: UniswapV3Quoter__quoteExactOutputSingleInputParamsStruct,
  ): UniswapV3Quoter__quoteExactOutputSingleResult {
    const result = super.call(
      "quoteExactOutputSingle",
      "quoteExactOutputSingle((address,address,uint256,uint24,uint160)):(uint256,uint160,uint32,uint256)",
      [ethereum.Value.fromTuple(params)],
    );

    return new UniswapV3Quoter__quoteExactOutputSingleResult(
      result[0].toBigInt(),
      result[1].toBigInt(),
      result[2].toBigInt(),
      result[3].toBigInt(),
    );
  }

  try_quoteExactOutputSingle(
    params: UniswapV3Quoter__quoteExactOutputSingleInputParamsStruct,
  ): ethereum.CallResult<UniswapV3Quoter__quoteExactOutputSingleResult> {
    const result = super.tryCall(
      "quoteExactOutputSingle",
      "quoteExactOutputSingle((address,address,uint256,uint24,uint160)):(uint256,uint160,uint32,uint256)",
      [ethereum.Value.fromTuple(params)],
    );
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    const value = result.value;
    return ethereum.CallResult.fromValue(
      new UniswapV3Quoter__quoteExactOutputSingleResult(
        value[0].toBigInt(),
        value[1].toBigInt(),
        value[2].toBigInt(),
        value[3].toBigInt(),
      ),
    );
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

  get _factory(): Address {
    return this._call.inputValues[0].value.toAddress();
  }

  get _WETH9(): Address {
    return this._call.inputValues[1].value.toAddress();
  }
}

export class ConstructorCall__Outputs {
  _call: ConstructorCall;

  constructor(call: ConstructorCall) {
    this._call = call;
  }
}

export class QuoteExactInputCall extends ethereum.Call {
  get inputs(): QuoteExactInputCall__Inputs {
    return new QuoteExactInputCall__Inputs(this);
  }

  get outputs(): QuoteExactInputCall__Outputs {
    return new QuoteExactInputCall__Outputs(this);
  }
}

export class QuoteExactInputCall__Inputs {
  _call: QuoteExactInputCall;

  constructor(call: QuoteExactInputCall) {
    this._call = call;
  }

  get path(): Bytes {
    return this._call.inputValues[0].value.toBytes();
  }

  get amountIn(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }
}

export class QuoteExactInputCall__Outputs {
  _call: QuoteExactInputCall;

  constructor(call: QuoteExactInputCall) {
    this._call = call;
  }

  get amountOut(): BigInt {
    return this._call.outputValues[0].value.toBigInt();
  }

  get sqrtPriceX96AfterList(): Array<BigInt> {
    return this._call.outputValues[1].value.toBigIntArray();
  }

  get initializedTicksCrossedList(): Array<BigInt> {
    return this._call.outputValues[2].value.toBigIntArray();
  }

  get gasEstimate(): BigInt {
    return this._call.outputValues[3].value.toBigInt();
  }
}

export class QuoteExactInputSingleCall extends ethereum.Call {
  get inputs(): QuoteExactInputSingleCall__Inputs {
    return new QuoteExactInputSingleCall__Inputs(this);
  }

  get outputs(): QuoteExactInputSingleCall__Outputs {
    return new QuoteExactInputSingleCall__Outputs(this);
  }
}

export class QuoteExactInputSingleCall__Inputs {
  _call: QuoteExactInputSingleCall;

  constructor(call: QuoteExactInputSingleCall) {
    this._call = call;
  }

  get params(): QuoteExactInputSingleCallParamsStruct {
    return changetype<QuoteExactInputSingleCallParamsStruct>(
      this._call.inputValues[0].value.toTuple(),
    );
  }
}

export class QuoteExactInputSingleCall__Outputs {
  _call: QuoteExactInputSingleCall;

  constructor(call: QuoteExactInputSingleCall) {
    this._call = call;
  }

  get amountOut(): BigInt {
    return this._call.outputValues[0].value.toBigInt();
  }

  get sqrtPriceX96After(): BigInt {
    return this._call.outputValues[1].value.toBigInt();
  }

  get initializedTicksCrossed(): BigInt {
    return this._call.outputValues[2].value.toBigInt();
  }

  get gasEstimate(): BigInt {
    return this._call.outputValues[3].value.toBigInt();
  }
}

export class QuoteExactInputSingleCallParamsStruct extends ethereum.Tuple {
  get tokenIn(): Address {
    return this[0].toAddress();
  }

  get tokenOut(): Address {
    return this[1].toAddress();
  }

  get amountIn(): BigInt {
    return this[2].toBigInt();
  }

  get fee(): i32 {
    return this[3].toI32();
  }

  get sqrtPriceLimitX96(): BigInt {
    return this[4].toBigInt();
  }
}

export class QuoteExactOutputCall extends ethereum.Call {
  get inputs(): QuoteExactOutputCall__Inputs {
    return new QuoteExactOutputCall__Inputs(this);
  }

  get outputs(): QuoteExactOutputCall__Outputs {
    return new QuoteExactOutputCall__Outputs(this);
  }
}

export class QuoteExactOutputCall__Inputs {
  _call: QuoteExactOutputCall;

  constructor(call: QuoteExactOutputCall) {
    this._call = call;
  }

  get path(): Bytes {
    return this._call.inputValues[0].value.toBytes();
  }

  get amountOut(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }
}

export class QuoteExactOutputCall__Outputs {
  _call: QuoteExactOutputCall;

  constructor(call: QuoteExactOutputCall) {
    this._call = call;
  }

  get amountIn(): BigInt {
    return this._call.outputValues[0].value.toBigInt();
  }

  get sqrtPriceX96AfterList(): Array<BigInt> {
    return this._call.outputValues[1].value.toBigIntArray();
  }

  get initializedTicksCrossedList(): Array<BigInt> {
    return this._call.outputValues[2].value.toBigIntArray();
  }

  get gasEstimate(): BigInt {
    return this._call.outputValues[3].value.toBigInt();
  }
}

export class QuoteExactOutputSingleCall extends ethereum.Call {
  get inputs(): QuoteExactOutputSingleCall__Inputs {
    return new QuoteExactOutputSingleCall__Inputs(this);
  }

  get outputs(): QuoteExactOutputSingleCall__Outputs {
    return new QuoteExactOutputSingleCall__Outputs(this);
  }
}

export class QuoteExactOutputSingleCall__Inputs {
  _call: QuoteExactOutputSingleCall;

  constructor(call: QuoteExactOutputSingleCall) {
    this._call = call;
  }

  get params(): QuoteExactOutputSingleCallParamsStruct {
    return changetype<QuoteExactOutputSingleCallParamsStruct>(
      this._call.inputValues[0].value.toTuple(),
    );
  }
}

export class QuoteExactOutputSingleCall__Outputs {
  _call: QuoteExactOutputSingleCall;

  constructor(call: QuoteExactOutputSingleCall) {
    this._call = call;
  }

  get amountIn(): BigInt {
    return this._call.outputValues[0].value.toBigInt();
  }

  get sqrtPriceX96After(): BigInt {
    return this._call.outputValues[1].value.toBigInt();
  }

  get initializedTicksCrossed(): BigInt {
    return this._call.outputValues[2].value.toBigInt();
  }

  get gasEstimate(): BigInt {
    return this._call.outputValues[3].value.toBigInt();
  }
}

export class QuoteExactOutputSingleCallParamsStruct extends ethereum.Tuple {
  get tokenIn(): Address {
    return this[0].toAddress();
  }

  get tokenOut(): Address {
    return this[1].toAddress();
  }

  get amount(): BigInt {
    return this[2].toBigInt();
  }

  get fee(): i32 {
    return this[3].toI32();
  }

  get sqrtPriceLimitX96(): BigInt {
    return this[4].toBigInt();
  }
}
