import { TokenSupply } from "../../generated/schema";

export function pushTokenSupplyArray(
  destinationArray: TokenSupply[],
  sourceArray: TokenSupply[],
): void {
  for (let i = 0; i < sourceArray.length; i++) {
    destinationArray.push(sourceArray[i]);
  }
}
