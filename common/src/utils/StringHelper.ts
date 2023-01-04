/**
 * Determines if two addresses (in string format) are equal.
 *
 * This ensures that:
 * - Both addresses are lowercase
 * - The correct equality test (==) is used: https://github.com/AssemblyScript/assemblyscript/issues/621
 */
export const addressesEqual = (one: string, two: string): boolean => {
  return one.toLowerCase() == two.toLowerCase();
};
