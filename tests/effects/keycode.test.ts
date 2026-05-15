import { describe, expect, test } from "vitest";

import { decodeKeycode } from "../../src/effects/index";

describe("decodeKeycode", () => {
  test("decodes a 5-character ASCII keycode (TRSRY)", () => {
    expect(decodeKeycode("0x5452535259")).toBe("TRSRY");
  });

  test("decodes a 5-character ASCII keycode (CHREG)", () => {
    expect(decodeKeycode("0x4348524547")).toBe("CHREG");
  });

  test("strips trailing zero bytes for shorter keycodes", () => {
    // "TOK" padded with 0x00 0x00 to fill bytes5
    expect(decodeKeycode("0x544f4b0000")).toBe("TOK");
  });
});
