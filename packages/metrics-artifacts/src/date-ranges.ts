import type { Manifest } from "./types.js";

export type DateRange = {
  start: string;
  end: string;
  days: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date: ${value}`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveDateRange(input: {
  start: string;
  end?: string;
  manifest: Manifest;
  maxRangeDays?: number;
  enforceMaxRange?: boolean;
}): DateRange {
  const end = input.end ?? input.manifest.latestDate;
  const startDate = parseDate(input.start);
  const endDate = parseDate(end);
  if (endDate.getTime() < startDate.getTime()) {
    throw new Error("end must be greater than or equal to start");
  }

  const days = Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
  if (input.enforceMaxRange && input.maxRangeDays !== undefined && days > input.maxRangeDays) {
    throw new Error(`Requested range is ${days} days; maximum is ${input.maxRangeDays} days.`);
  }

  return {
    start: input.start,
    end,
    days,
  };
}

export function monthKeysForRange(range: DateRange): string[] {
  const start = parseDate(range.start);
  const end = parseDate(range.end);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const keys: string[] = [];

  while (cursor.getTime() <= endMonth.getTime()) {
    keys.push(formatDate(cursor).slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys;
}
