import { TokenRecord, TokenSupply } from "../../generated/schema";

export function pushArray(destinationArray: TokenRecord[], sourceArray: TokenRecord[]): void {
  for (let i = 0; i < sourceArray.length; i++) {
    destinationArray.push(sourceArray[i]);
  }
}

export function pushTokenSupplyArray(
  destinationArray: TokenSupply[],
  sourceArray: TokenSupply[],
): void {
  for (let i = 0; i < sourceArray.length; i++) {
    destinationArray.push(sourceArray[i]);
  }
}
