import { ERC20_TOKENS_ARBITRUM } from "../../../arbitrum/src/contracts/Constants";
import { ERC20_TOKENS_BASE } from "../../../base/src/contracts/Constants";
import { ERC20_TOKENS_BERACHAIN } from "../../../berachain/src/contracts/Constants";
import { ERC20_TOKENS } from "../../../ethereum/src/utils/Constants";
import { ERC20_TOKENS_FANTOM } from "../../../fantom/src/contracts/Constants";
import { ERC20_TOKENS_POLYGON } from "../../../polygon/src/contracts/Constants";
import { TokenDefinition } from "../contracts/TokenDefinition";

/**
/**
 * Returns the ERC20 tokens for a given blockchain.
 * @param blockchain - The blockchain to get the tokens for.
 * @returns A map of token addresses to token definitions.
 */
export function getTokensForChain(blockchain: string): Map<string, TokenDefinition> {
  if (blockchain === "Ethereum") {
    return ERC20_TOKENS;
  }
  if (blockchain === "Polygon") {
    return ERC20_TOKENS_POLYGON;
  }
  if (blockchain === "Base") {
    return ERC20_TOKENS_BASE;
  }
  if (blockchain === "Arbitrum") {
    return ERC20_TOKENS_ARBITRUM;
  }
  if (blockchain === "Berachain") {
    return ERC20_TOKENS_BERACHAIN;
  }
  if (blockchain === "Fantom") {
    return ERC20_TOKENS_FANTOM;
  }
  return new Map<string, TokenDefinition>();
}
