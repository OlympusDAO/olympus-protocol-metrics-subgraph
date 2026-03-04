/**
 * Converts a Unix timestamp to an ISO 8601 date string (YYYY-MM-DD).
 */
export function toDateString(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split("T")[0]!;
}

/**
 * Finds a token definition by address (case-insensitive).
 */
export function findTokenByAddress<T extends { address: string }>(
  tokens: T[],
  address: string,
): T | undefined {
  const lower = address.toLowerCase();
  return tokens.find((t) => t.address.toLowerCase() === lower);
}
