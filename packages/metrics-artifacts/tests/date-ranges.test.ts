import { describe, expect, test } from "vitest";

import { monthKeysForRange, resolveDateRange } from "../src";
import type { Manifest } from "../src";

const manifest: Manifest = {
  schemaVersion: "1.0.0",
  generatedAt: "2026-06-01T08:15:00.000Z",
  earliestDate: "2021-04-29",
  latestDate: "2026-06-01",
};

describe("date range resolution", () => {
  test("defaults missing end date to manifest latestDate", () => {
    expect(resolveDateRange({ start: "2026-05-20", manifest })).toEqual({
      start: "2026-05-20",
      end: "2026-06-01",
      days: 13,
    });
  });

  test("rejects end date before start date", () => {
    expect(() =>
      resolveDateRange({ start: "2026-06-01", end: "2026-05-20", manifest }),
    ).toThrow(/end must be greater than or equal to start/i);
  });

  test("enforces max range only when requested", () => {
    expect(() =>
      resolveDateRange({
        start: "2025-01-01",
        end: "2026-06-01",
        manifest,
        maxRangeDays: 366,
        enforceMaxRange: true,
      }),
    ).toThrow(/maximum is 366 days/i);

    expect(
      resolveDateRange({
        start: "2025-01-01",
        end: "2026-06-01",
        manifest,
        maxRangeDays: 366,
        enforceMaxRange: false,
      }).days,
    ).toBeGreaterThan(366);
  });

  test("selects month shards across month and year boundaries", () => {
    expect(
      monthKeysForRange({ start: "2025-12-31", end: "2026-02-01", days: 33 }),
    ).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});
