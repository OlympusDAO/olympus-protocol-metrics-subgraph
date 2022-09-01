import { TokenRecord } from "../subgraph";

export const calculateMarketValue = (records: TokenRecord[]): number => {
  return records.reduce((previousValue, record) => {
    return previousValue + +record.value;
  }, 0);
};

export const calculateMarketValueCategory = (records: TokenRecord[], category: string): number => {
  return records
    .filter((record) => record.category == category)
    .reduce((previousValue, record) => {
      return previousValue + +record.value;
    }, 0);
};

export const calculateLiquidBacking = (records: TokenRecord[]): number => {
  return records
    .filter((record) => record.isLiquid == true)
    .reduce((previousValue, record) => {
      return previousValue + +record.valueExcludingOhm;
    }, 0);
};
