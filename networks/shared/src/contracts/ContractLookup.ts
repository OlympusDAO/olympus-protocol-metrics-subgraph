export type ContractNameLookup = (
  tokenAddress: string,
  suffix?: string | null,
  abbreviation?: string | null // Avoid last comma
) => string;
