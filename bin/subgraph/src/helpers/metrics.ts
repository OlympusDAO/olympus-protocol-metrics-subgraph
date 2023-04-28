import { TokenRecord, TokenSupply } from "../subgraph";

// Source: https://github.com/OlympusDAO/olympus-protocol-metrics-subgraph/blob/master/subgraphs/ethereum/src/utils/TokenSupplyHelper.ts
const TYPE_BONDS_DEPOSITS = "OHM Bonds (Burnable Deposits)";
const TYPE_BONDS_PREMINTED = "OHM Bonds (Pre-minted)";
const TYPE_BONDS_VESTING_DEPOSITS = "OHM Bonds (Vesting Deposits)";
const TYPE_BONDS_VESTING_TOKENS = "OHM Bonds (Vesting Tokens)";
const TYPE_BOOSTED_LIQUIDITY_VAULT = "Boosted Liquidity Vault";
const TYPE_LENDING = "Lending";
const TYPE_LIQUIDITY = "Liquidity";
const TYPE_OFFSET = "Manual Offset";
const TYPE_TOTAL_SUPPLY = "Total Supply";
const TYPE_TREASURY = "Treasury";

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

export const calculateSupplySum = (records: TokenSupply[]): number => {
  return records.reduce((previousValue, record) => {
    return previousValue + +record.supplyBalance;
  }, 0);
}

// Source: https://github.com/OlympusDAO/olympus-protocol-metrics-subgraph/blob/9ef60c7c2be9fc9b45dd98dd119c0fa5cefb4760/subgraphs/ethereum/src/utils/OhmCalculations.ts#L673
export const calculateCirculatingSupply = (records: TokenSupply[]): number => {
  let total = 0;

  const includedTypes = [TYPE_TOTAL_SUPPLY, TYPE_TREASURY, TYPE_OFFSET, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_DEPOSITS, TYPE_BOOSTED_LIQUIDITY_VAULT];

  for (let i = 0; i < records.length; i++) {
    const tokenSupply = records[i];

    if (!includedTypes.includes(tokenSupply.type)) {
      continue;
    }

    total += Number(tokenSupply.supplyBalance);
  }

  return total;
};

// Source: https://github.com/OlympusDAO/olympus-protocol-metrics-subgraph/blob/9ef60c7c2be9fc9b45dd98dd119c0fa5cefb4760/subgraphs/ethereum/src/utils/OhmCalculations.ts#L643
export const calculateFloatingSupply = (records: TokenSupply[]): number => {
  let total = 0;

  const includedTypes = [TYPE_TOTAL_SUPPLY, TYPE_TREASURY, TYPE_OFFSET, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_DEPOSITS, TYPE_BOOSTED_LIQUIDITY_VAULT, TYPE_LIQUIDITY];

  for (let i = 0; i < records.length; i++) {
    const tokenSupply = records[i];

    if (!includedTypes.includes(tokenSupply.type)) {
      continue;
    }

    total += Number(tokenSupply.supplyBalance);
  }

  return total;
}

// Source: https://github.com/OlympusDAO/olympus-protocol-metrics-subgraph/blob/9ef60c7c2be9fc9b45dd98dd119c0fa5cefb4760/subgraphs/ethereum/src/utils/OhmCalculations.ts#L612
export const calculateBackedSupply = (records: TokenSupply[]): number => {
  let total = 0;

  const includedTypes = [TYPE_TOTAL_SUPPLY, TYPE_TREASURY, TYPE_OFFSET, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_DEPOSITS, TYPE_BOOSTED_LIQUIDITY_VAULT, TYPE_LIQUIDITY, TYPE_LENDING];

  for (let i = 0; i < records.length; i++) {
    const tokenSupply = records[i];

    if (!includedTypes.includes(tokenSupply.type)) {
      continue;
    }

    total += Number(tokenSupply.supplyBalance);
  }

  return total;
}
