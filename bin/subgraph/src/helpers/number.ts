const DIFF_THRESHOLD = 1000;

export const valuesEqual = (
  value1: number,
  value2: number,
  threshold = DIFF_THRESHOLD,
): boolean => {
  return value1 - value2 < threshold && value2 - value1 < threshold;
};

export const formatCurrency = (value: number, decimals = 0): string => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
  });
};

export const formatNumber = (value: number, decimals = 0): string => {
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals });
};
