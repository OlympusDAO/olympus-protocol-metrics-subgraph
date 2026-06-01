import type { Manifest } from "./types";

export type DateRange = {
  start: string;
  end: string;
  days: number;
};

export function resolveDateRange(_input: {
  start: string;
  end?: string;
  manifest: Manifest;
  maxRangeDays?: number;
  enforceMaxRange?: boolean;
}): DateRange {
  throw new Error("Not implemented");
}

export function monthKeysForRange(_range: DateRange): string[] {
  throw new Error("Not implemented");
}
