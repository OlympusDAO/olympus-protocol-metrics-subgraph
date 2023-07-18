import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { TokenSupply } from "../../../shared/generated/schema";
import { getERC20DecimalBalance } from "../../../shared/src/contracts/ERC20";
import { pushTokenSupplyArray } from "../../../shared/src/utils/ArrayHelper";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { LendingMarketDeployment } from "../../../shared/src/utils/LendingMarketDeployment";
import { createOrUpdateTokenSupply, TYPE_LENDING, TYPE_LIQUIDITY, TYPE_TOTAL_SUPPLY, TYPE_TREASURY } from "../../../shared/src/utils/TokenSupplyHelper";
import { ERC20 } from "../../generated/TokenRecords-arbitrum/ERC20";
import { OlympusLender } from "../../generated/TokenRecords-arbitrum/OlympusLender";
import { CIRCULATING_SUPPLY_WALLETS, ERC20_GOHM_SYNAPSE, ERC20_OHM, OLYMPUS_LENDER, SENTIMENT_DEPLOYMENTS, SENTIMENT_LTOKEN, SILO_ADDRESS, SILO_DEPLOYMENTS } from "../contracts/Constants";
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
 * Generates TokenSupply records for OHM that has been minted and deposited into lending markets
 * using the OlympusLender/LendingAMO contract.
 * 
 * @param timestamp 
 * @param blockNumber 
 * @returns 
 */
export function getLendingAMOOHMRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  // Grab the number of AMOs
  const lenderContract = OlympusLender.bind(Address.fromString(OLYMPUS_LENDER));
  const amoCountResult = lenderContract.try_activeAMOCount();
  if (amoCountResult.reverted) {
    return records;
  }

  const amoCount = amoCountResult.value.toI64();
  for (let i = 0; i < amoCount; i++) {
    // Get the AMO address
    const amoAddressResult = lenderContract.try_activeAMOs(BigInt.fromU32(i));
    if (amoAddressResult.reverted) {
      continue;
    }

    const amoAddress = amoAddressResult.value;
    // Get deployed OHM
    const deployedOhmResult = lenderContract.try_getDeployedOhm(amoAddress);
    if (deployedOhmResult.reverted) {
      continue;
    }

    const deployedOhm = deployedOhmResult.value;
    if (deployedOhm.equals(BigInt.zero())) {
      continue;
    }

    records.push(
      createOrUpdateTokenSupply(
        timestamp,
        getContractName(ERC20_OHM),
        ERC20_OHM,
        null,
        null,
        `${getContractName(OLYMPUS_LENDER)} - ${amoAddress.toHexString()}`,
        amoAddress.toHexString(),
        TYPE_LENDING,
        toDecimal(deployedOhm, 9),
        blockNumber,
        -1, // Subtract
      )
    )
  }

  return records;
}

function getLendingMarketManualDeploymentOHMRecords(timestamp: BigInt, deploymentAddress: string, deployments: LendingMarketDeployment[], blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];
  let balance = BigDecimal.zero();

  // Calculate a running balance for the OHM tokens deposited into the lending market
  for (let i = 0; i < deployments.length; i++) {
    const currentDeployment = deployments[i];
    // Exclude if before deployment
    if (blockNumber.lt(currentDeployment.getBlockNumber())) {
      continue;
    }

    // Exclude if not OHM
    if (currentDeployment.getToken().toLowerCase() != ERC20_OHM.toLowerCase()) {
      continue;
    }

    balance = balance.plus(currentDeployment.getAmount());
  }

  // Skip if there's no balance at the current block
  if (balance.equals(BigDecimal.zero())) {
    return records;
  }

  // Record the balance at the current block
  records.push(
    createOrUpdateTokenSupply(
      timestamp,
      getContractName(ERC20_OHM),
      ERC20_OHM,
      null,
      null,
      getContractName(deploymentAddress),
      deploymentAddress,
      TYPE_LENDING,
      balance,
      blockNumber,
      -1, // Subtract, as this represents OHM taken out of supply
    ),
  );

  return records;
}

/**
 * Generates TokenSupply records for OHM that has been minted and deposited into lending markets.
 * 
 * This includes both manual and automated (lending AMO) deposits.
 * 
 * @param timestamp 
 * @param blockNumber 
 */
export function getLendingMarketOHMRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  // Lending AMO
  pushTokenSupplyArray(
    records,
    getLendingAMOOHMRecords(timestamp, blockNumber),
  );

  // Silo
  pushTokenSupplyArray(
    records,
    getLendingMarketManualDeploymentOHMRecords(timestamp, SILO_ADDRESS, SILO_DEPLOYMENTS, blockNumber),
  );

  // Sentiment
  pushTokenSupplyArray(
    records,
    getLendingMarketManualDeploymentOHMRecords(timestamp, SENTIMENT_LTOKEN, SENTIMENT_DEPLOYMENTS, blockNumber),
  );

  return records;
}

/**
 * The start block for accounting of protocol-owned gOHM on Arbitrum.
 */
const START_BLOCK = "84000000";

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

  // Accounting for gOHM on Arbitrum was added late, so we don't want to mess up historical accounting/reports.
  if (blockNumber.lt(BigInt.fromString(START_BLOCK))) {
    return records;
  }

  // Add Synapse gOHM
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

  // Add native OHM
  for (let i = 0; i < CIRCULATING_SUPPLY_WALLETS.length; i++) {
    const currentWallet = CIRCULATING_SUPPLY_WALLETS[i];
    const balance = getERC20DecimalBalance(ERC20_OHM, currentWallet, blockNumber, getContractName);
    if (balance.equals(BigDecimal.zero())) continue;

    records.push(
      createOrUpdateTokenSupply(
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

  // Accounting for gOHM on Arbitrum was added late, so we don't want to mess up historical accounting/reports.
  if (blockNumber.lt(BigInt.fromString(START_BLOCK))) {
    return records;
  }

  const ohmTokens = [ERC20_GOHM_SYNAPSE, ERC20_OHM];
  const wallets = CIRCULATING_SUPPLY_WALLETS;

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
