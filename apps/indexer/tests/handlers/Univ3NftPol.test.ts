import { describe, expect, test } from "vitest";

import { univ3PoolKey } from "../../src/handlers/Univ3NftPol";

describe("univ3PoolKey", () => {
  const ohm = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5";
  const weth = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

  test("distinguishes fee-tier pools for the same token pair", () => {
    expect(univ3PoolKey([ohm, weth], 3000)).not.toBe(univ3PoolKey([ohm, weth], 10000));
  });

  test("is independent of token order", () => {
    expect(univ3PoolKey([ohm, weth], 10000)).toBe(univ3PoolKey([weth, ohm], 10000));
  });
});
