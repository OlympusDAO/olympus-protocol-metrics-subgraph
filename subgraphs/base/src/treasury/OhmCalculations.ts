import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenSupply } from "../../../shared/generated/schema";
import { getERC20DecimalBalance } from "../../../shared/src/contracts/ERC20";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { createTokenSupply, TYPE_LIQUIDITY, TYPE_TOTAL_SUPPLY, TYPE_TREASURY } from "../../../shared/src/utils/TokenSupplyHelper";
import { ERC20 } from "../../generated/TokenRecords-base/ERC20";
import { PROTOCOL_ADDRESSES, ERC20_OHM } from "../contracts/Constants";
import { getContractName } from "../contracts/Contracts";
import { PRICE_HANDLERS } from "../price/PriceLookup";

export function getTotalSupply(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const contract = ERC20.bind(Address.fromString(ERC20_OHM));
  const totalSupplyResult = contract.try_totalSupply();
  const decimalsResult = contract.try_decimals();
  if (totalSupplyResult.reverted || decimalsResult.reverted) {
    return [];
  }

  const totalSupply = toDecimal(totalSupplyResult.value, decimalsResult.value);
  return [createTokenSupply(
    timestamp, getContractName(ERC20_OHM), ERC20_OHM, null, null, null, null, TYPE_TOTAL_SUPPLY, totalSupply, blockNumber)];
}

/**
 * Returns the supply of protocol- and DAO-owned OHM and gOHM at the given block number.
 *
 * Unlike on Ethereum mainnet, the raw gOHM value is added to the TokenSupply records.
 * This will be converted later into a quantity of OHM.
 *
 * @param timestamp the current timestamp
 * @param blockNumber the current block number
 * @returns TokenSupply records
 */
export function getTreasuryOHMRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  // Add native OHM
  for (let i = 0; i < PROTOCOL_ADDRESSES.length; i++) {
    const currentWallet = PROTOCOL_ADDRESSES[i];
    const balance = getERC20DecimalBalance(ERC20_OHM, currentWallet, blockNumber, getContractName);
    if (balance.equals(BigDecimal.zero())) continue;

    records.push(
      createTokenSupply(
        timestamp,
        getContractName(ERC20_OHM),
        ERC20_OHM,
        null,
        null,
        getContractName(currentWallet),
        currentWallet,
        TYPE_TREASURY,
        balance,
        blockNumber,
        -1, // Subtract
      ),
    );
  }

  return records;
}

/**
 * Returns the quantity of OHM owned by the treasury in
 * liquidity pools.
 *
 * @param blockNumber
 * @returns
 */
export function getProtocolOwnedLiquiditySupplyRecords(
  timestamp: BigInt,
  blockNumber: BigInt,
): TokenSupply[] {
  const records: TokenSupply[] = [];

  const ohmTokens = [ERC20_OHM];
  const wallets = PROTOCOL_ADDRESSES;

  for (let i = 0; i < PRICE_HANDLERS.length; i++) {
    const pairHandler = PRICE_HANDLERS[i];

    for (let j = 0; j < ohmTokens.length; j++) {
      const currentOhmToken = ohmTokens[j];
      // We only want to look at pairs that contain an OHM token
      if (!pairHandler.matches(currentOhmToken)) {
        continue;
      }

      for (let k = 0; k < wallets.length; k++) {
        const currentWallet = wallets[k];
        const balance: BigDecimal = pairHandler.getUnderlyingTokenBalance(currentWallet, currentOhmToken, blockNumber);
        if (balance.equals(BigDecimal.zero())) {
          continue;
        }

        records.push(
          createTokenSupply(
            timestamp,
            getContractName(currentOhmToken),
            currentOhmToken,
            getContractName(pairHandler.getId()),
            pairHandler.getId(),
            getContractName(currentWallet),
            currentWallet,
            TYPE_LIQUIDITY,
            balance,
            blockNumber,
            -1, // Subtract
          ),
        )
      }
    }
  }

  return records;
}
