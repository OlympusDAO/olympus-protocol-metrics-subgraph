import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenSupply } from "../../../shared/generated/schema";
import { getERC20DecimalBalance } from "../../../shared/src/contracts/ERC20";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { createOrUpdateTokenSupply, TYPE_LIQUIDITY, TYPE_TOTAL_SUPPLY, TYPE_TREASURY } from "../../../shared/src/utils/TokenSupplyHelper";
import { ERC20 } from "../../generated/TokenRecords-arbitrum/ERC20";
import { CIRCULATING_SUPPLY_WALLETS, ERC20_GOHM_SYNAPSE, ERC20_OHM } from "../contracts/Constants";
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
  return [createOrUpdateTokenSupply(
    timestamp, getContractName(ERC20_OHM), ERC20_OHM, null, null, null, null, TYPE_TOTAL_SUPPLY, totalSupply, blockNumber)];
}

/**
 * The start block for accounting of protocol-owned gOHM on Arbitrum.
 */
const START_BLOCK = "84000000";

/**
 * Returns the supply of protocol- and DAO-owned gOHM at the given block number.
 *
 * Unlike on Ethereum mainnet, the raw gOHM value is added to the TokenSupply records.
 * This will be converted later into a quantity of OHM.
 * 
 * OHM and sOHM do not exist natively on Arbitrum at this time, so are not included
 *
 * @param timestmap the current timestamp
 * @param blockNumber the current block number
 * @returns TokenSupply records
 */
export function getTreasuryOHMRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  // Accounting for gOHM on Arbitrum was added late, so we don't want to mess up historical accounting/reports.
  if (blockNumber.lt(BigInt.fromString(START_BLOCK))) {
    return records;
  }

  for (let i = 0; i < CIRCULATING_SUPPLY_WALLETS.length; i++) {
    const currentWallet = CIRCULATING_SUPPLY_WALLETS[i];
    const balance = getERC20DecimalBalance(ERC20_GOHM_SYNAPSE, currentWallet, blockNumber, getContractName);
    if (balance.equals(BigDecimal.zero())) continue;

    /**
     * Traditionally, the index is used to convert gOHM to OHM. However,
     * the OHM index is not available on the gOHM Synapse contract on Arbitrum.
     * 
     * Instead, we create a TokenSupply record for the gOHM Synapse contract,
     * and the frontend will use the index to convert gOHM to OHM.
     */
    records.push(
      createOrUpdateTokenSupply(
        timestamp,
        getContractName(ERC20_GOHM_SYNAPSE),
        ERC20_GOHM_SYNAPSE,
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

  // Accounting for gOHM on Arbitrum was added late, so we don't want to mess up historical accounting/reports.
  if (blockNumber.lt(BigInt.fromString(START_BLOCK))) {
    return records;
  }

  const ohmTokens = [ERC20_GOHM_SYNAPSE];
  const wallets = CIRCULATING_SUPPLY_WALLETS;

  for (let i = 0; i < PRICE_HANDLERS.length; i++) {
    const pairHandler = PRICE_HANDLERS[i];

    for (let j = 0; j < ohmTokens.length; j++) {
      const currentOhmToken = ohmTokens[j];
      // We only want to look at pairs that contain gOHM
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
          createOrUpdateTokenSupply(
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
