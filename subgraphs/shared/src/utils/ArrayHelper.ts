import { TokenRecord, TokenSupply } from "../../generated/schema";

/**
 * Determines if the given string array loosely includes the given value.
 *
 * This is used as Array.includes() uses strict equality, and the strings
 * provided by {Address} are not always the same.
 *
 * This also ensures that when comparison is performed, both strings
 * are lowercase.
 *
 * @param array the array to iterate over
 * @param value the value to check against
 * @returns
 */
export function arrayIncludesLoose(array: string[], value: string): boolean {
  for (let i = 0; i < array.length; i++) {
    if (array[i].toLowerCase() == value.toLowerCase()) return true;
  }

  return false;
}

export function pushTokenRecordArray(destinationArray: TokenRecord[], sourceArray: TokenRecord[]): void {
  for (let i = 0; i < sourceArray.length; i++) {
    destinationArray.push(sourceArray[i]);
  }
}

export function pushTokenSupplyArray(destinationArray: TokenSupply[], sourceArray: TokenSupply[]): void {
  for (let i = 0; i < sourceArray.length; i++) {
    destinationArray.push(sourceArray[i]);
  }
}
