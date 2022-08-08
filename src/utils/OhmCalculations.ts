import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { sOlympusERC20V3 } from "../../generated/ProtocolMetrics/sOlympusERC20V3";
import { TokenRecord, TokenRecords } from "../../generated/schema";
import {
  CIRCULATING_SUPPLY_WALLETS,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_OHM_V2_BLOCK,
  ERC20_SOHM_V1,
  ERC20_SOHM_V2,
  ERC20_SOHM_V2_BLOCK,
  ERC20_SOHM_V3,
  ERC20_SOHM_V3_BLOCK,
  getContractName,
  LIQUIDITY_OWNED,
  MIGRATION_CONTRACT,
} from "./Constants";
import {
  getERC20,
  getERC20Balance,
  getSOlympusERC20,
  getSOlympusERC20V2,
  getSOlympusERC20V3,
} from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getBalancerPoolTokenQuantity } from "./LiquidityBalancer";
import { getCurvePairTokenQuantity } from "./LiquidityCurve";
import { getFraxSwapPairTokenQuantityRecords } from "./LiquidityFraxSwap";
import { getUniswapV2PairTokenQuantity } from "./LiquidityUniswapV2";
import { PairHandlerTypes } from "./PairHandler";
import { getBaseOhmUsdRate } from "./Price";
import {
  addToMetricName,
  combineTokenRecords,
  newTokenRecord,
  newTokenRecords,
  pushTokenRecord,
  setTokenRecordsMultiplier,
} from "./TokenRecordHelper";

const MIGRATION_OFFSET_STARTING_BLOCK = "14381564";
const MIGRATION_OFFSET = "2013";

/**
 * Returns the current staking index, based on the current block.
 *
 * If the current block is after {ERC20_SOHM_V3_BLOCK}, the index from the
 * sOHM v3 contract is returned.
 *
 * Otherwise, the index from the sOHM v2 contract is returned.
 *
 * @param blockNumber the current block number
 * @returns BigDecimal
 */
export function getCurrentIndex(blockNumber: BigInt): BigDecimal {
  if (blockNumber.gt(BigInt.fromString(ERC20_SOHM_V3_BLOCK))) {
    const contractV3 = getSOlympusERC20V3("sOHM V3", ERC20_SOHM_V3, blockNumber);
    if (!contractV3) {
      throw new Error("Expected to be able to bind to sOHM V3 at block " + blockNumber.toString());
    }

    return toDecimal(contractV3.index(), 9);
  } else {
    /**
     * {ERC20_SOHM_V2_BLOCK} is far before the typical starting block of this subgraph (14,000,000),
     * so we don't really need to test for it.
     *
     * TODO: However, if we do ever push the starting block back before {ERC20_SOHM_V2_BLOCK}, we need
     * to consider how to determine the index from sOHM V1, as it doesn't have an `index()` function.
     */
    const contractV2 = getSOlympusERC20V2("sOHM V2", ERC20_SOHM_V2, blockNumber);
    if (!contractV2) {
      throw new Error("Expected to be able to bind to sOHM V2 at block " + blockNumber.toString());
    }

    return toDecimal(contractV2.index(), 9);
  }
}

/**
 * Returns the total supply of the latest version of the OHM contract
 * at the given block number.
 *
 * @param blockNumber the current block number
 * @returns BigDecimal representing the total supply at the time of the block
 */
export function getTotalSupply(blockNumber: BigInt): BigDecimal {
  const ohmContractAddress = blockNumber.gt(BigInt.fromString(ERC20_OHM_V2_BLOCK))
    ? ERC20_OHM_V2
    : ERC20_OHM_V1;

  const ohmContract = getERC20(ohmContractAddress, blockNumber);

  if (!ohmContract) {
    log.error(
      "Expected to be able to bind to OHM contract at address {} for block {}, but it was not found.",
      [ohmContractAddress, blockNumber.toString()],
    );
    return BigDecimal.fromString("0");
  }

  return toDecimal(ohmContract.totalSupply(), 9);
}

/**
 * Returns TokenRecords representing a manual offset in the migration contract.
 *
 * Reasoning:
 * - OHMv1 stopped rebasing at index 46.721314322
 * - We put into the migrator contract the number of OHMv1 tokens times that index as gOHM
 * - When someone migrates OHMv1 to OHMv2, it uses the gOHM from that contract, burns their OHMv1 and gives them either gOHM or unwraps it to sOHMv2
 * - When we migrated the OHMv1 in LP, we didn't use the migrator contract, so it didn't remove the gOHM that had been set aside for it
 *
 * This takes effect from Mar-14-2022 12:38:48 AM (block {MIGRATION_OFFSET_STARTING_BLOCK}).
 *
 * The initial version of this applied an offset of `5,838.1668738299 * current index`.
 *
 * On 29th June 2022, this was adjusted on the advice of the policy team to be: `2013 * current index`.
 *
 * What is implemented:
 * - If before {MIGRATION_OFFSET_STARTING_BLOCK}, returns null
 * - Binds with the sOHM V3 contract
 * - Multiplies index() from sOHM V3 by {MIGRATION_OFFSET}
 * - Returns a token record with the offset
 *
 * @param blockNumber
 * @returns
 */
function getMigrationOffsetRecord(metricName: string, blockNumber: BigInt): TokenRecord | null {
  if (blockNumber.lt(BigInt.fromString(MIGRATION_OFFSET_STARTING_BLOCK))) {
    return null;
  }

  // Bind the sOHM V3 contract to get the index
  const sOhmContract = sOlympusERC20V3.bind(Address.fromString(ERC20_SOHM_V3));
  const offset = toDecimal(sOhmContract.index(), sOhmContract.decimals()).times(
    BigDecimal.fromString(MIGRATION_OFFSET),
  );
  log.info("Calculated migration offset at block {} and index {} is {}", [
    blockNumber.toString(),
    sOhmContract.index().toString(),
    offset.toString(),
  ]);

  return newTokenRecord(
    metricName,
    getContractName(ERC20_OHM_V2, "Migration Offset"),
    ERC20_OHM_V2,
    getContractName(MIGRATION_CONTRACT),
    MIGRATION_CONTRACT,
    BigDecimal.fromString("1"),
    offset,
    blockNumber,
    BigDecimal.fromString("-1"), // Will be subtracted
  );
}

/**
 * Returns the circulating supply of the latest version of the OHM contract
 * at the given block number.
 *
 * Circulating supply is defined as:
 * - OHM total supply
 * - subtract: OHM in {CIRCULATING_SUPPLY_WALLETS}
 * - subtract: migration offset
 *
 * @param blockNumber the current block number
 * @param totalSupply the total supply of OHM
 * @returns BigDecimal representing the circulating supply at the time of the block
 */
export function getCirculatingSupply(
  metricName: string,
  blockNumber: BigInt,
  totalSupply: BigDecimal,
): TokenRecords {
  const isV2Contract = blockNumber.gt(BigInt.fromString(ERC20_OHM_V2_BLOCK));
  const ohmContractAddress = isV2Contract ? ERC20_OHM_V2 : ERC20_OHM_V1;

  const ohmContract = getERC20(ohmContractAddress, blockNumber);
  const records = newTokenRecords(addToMetricName(metricName, "OHMCirculatingSupply"), blockNumber);

  if (!ohmContract) {
    log.error(
      "Expected to be able to bind to OHM contract at address {} for block {}, but it was not found.",
      [ohmContractAddress, blockNumber.toString()],
    );
    return records;
  }

  // Total supply
  pushTokenRecord(
    records,
    newTokenRecord(
      records.id,
      getContractName(ohmContractAddress),
      ohmContractAddress,
      "OHM Total Supply",
      "N/A",
      BigDecimal.fromString("1"),
      totalSupply,
      blockNumber,
    ),
  );

  for (let i = 0; i < CIRCULATING_SUPPLY_WALLETS.length; i++) {
    const currentWallet = CIRCULATING_SUPPLY_WALLETS[i];
    const balance = getERC20Balance(ohmContract, currentWallet, blockNumber);
    if (balance.equals(BigInt.zero())) continue;

    pushTokenRecord(
      records,
      newTokenRecord(
        records.id,
        getContractName(ohmContractAddress),
        ohmContractAddress,
        getContractName(currentWallet),
        currentWallet,
        BigDecimal.fromString("1"),
        toDecimal(balance, 9),
        blockNumber,
        BigDecimal.fromString("-1"), // Subtract
      ),
    );
  }

  // Migration offset
  const migrationOffsetRecord = getMigrationOffsetRecord(metricName, blockNumber);
  if (migrationOffsetRecord) {
    pushTokenRecord(records, migrationOffsetRecord);
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
function getLiquiditySupply(metricName: string, blockNumber: BigInt): TokenRecords {
  const currentMetricName = addToMetricName(metricName, "OHMLiquiditySupply");
  const records = newTokenRecords(currentMetricName, blockNumber);

  for (let i = 0; i < LIQUIDITY_OWNED.length; i++) {
    const pairHandler = LIQUIDITY_OWNED[i];
    const pairAddress = pairHandler.getContract();

    // We can just query the balance of the OHM token(s) in the pair address
    const ohmTokens = [ERC20_OHM_V1, ERC20_OHM_V2];
    for (let j = 0; j < ohmTokens.length; j++) {
      const ohmTokenAddress = ohmTokens[j];

      if (pairHandler.getType() == PairHandlerTypes.Balancer) {
        const pairPoolAddress = pairHandler.getPool();
        if (pairPoolAddress === null) {
          throw new Error("Balancer pool address is not set");
        }

        combineTokenRecords(
          records,
          getBalancerPoolTokenQuantity(
            currentMetricName,
            pairAddress,
            pairPoolAddress,
            ohmTokenAddress,
            blockNumber,
          ),
        );
      } else if (pairHandler.getType() == PairHandlerTypes.Curve) {
        combineTokenRecords(
          records,
          getCurvePairTokenQuantity(currentMetricName, pairAddress, ohmTokenAddress, blockNumber),
        );
      } else if (pairHandler.getType() == PairHandlerTypes.UniswapV2) {
        combineTokenRecords(
          records,
          getUniswapV2PairTokenQuantity(
            currentMetricName,
            pairAddress,
            ohmTokenAddress,
            blockNumber,
          ),
        );
      } else if (pairHandler.getType() == PairHandlerTypes.FraxSwap) {
        combineTokenRecords(
          records,
          getFraxSwapPairTokenQuantityRecords(
            currentMetricName,
            pairAddress,
            ohmTokenAddress,
            blockNumber,
          ),
        );
      } else {
        throw new Error("Unsupported pair type: " + pairHandler.getType().toString());
      }
    }
  }

  return records;
}

/**
 * The floating supply of OHM is defined as:
 * - circulating supply
 * - minus the quantity of OHM owned by the treasury in liquidity pools
 *
 * Can be compared against: https://dune.com/queries/905861
 *
 * @param totalSupply
 * @param blockNumber
 * @returns
 */
export function getFloatingSupply(
  metricName: string,
  totalSupply: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(addToMetricName(metricName, "OHMFloatingSupply"), blockNumber);

  // Circulating supply
  combineTokenRecords(records, getCirculatingSupply(metricName, blockNumber, totalSupply));

  // Liquidity supply
  const liquiditySupply = getLiquiditySupply(metricName, blockNumber);
  setTokenRecordsMultiplier(liquiditySupply, BigDecimal.fromString("-1")); // Subtracted
  combineTokenRecords(records, liquiditySupply);

  return records;
}

/**
 * Returns the market cap for the latest version of the OHM contract
 * at the given block number.
 *
 * Market cap is calculated as: OHM-USD rate * circulating supply of OHM
 *
 * @param blockNumber the current block number
 * @returns BigDecimal representing the market cap at the current block
 */
export function getOhmMarketcap(metricName: string, blockNumber: BigInt): BigDecimal {
  return getBaseOhmUsdRate(blockNumber).times(
    getCirculatingSupply(metricName, blockNumber, getTotalSupply(blockNumber)).value,
  );
}

/**
 * Returns the circulating supply of sOHM V1, V2 or V3, depending on the current block.
 *
 * @param blockNumber the current block number
 * @returns BigDecimal representing the total circulating supply at the current block
 */
export function getSOhmCirculatingSupply(blockNumber: BigInt): BigDecimal {
  let sOhmSupply = BigDecimal.fromString("0");

  if (blockNumber.gt(BigInt.fromString(ERC20_SOHM_V3_BLOCK))) {
    const contractV3 = getSOlympusERC20V3("sOHM V3", ERC20_SOHM_V3, blockNumber);
    if (!contractV3) {
      throw new Error("Expected to be able to bind to sOHM V3 at block " + blockNumber.toString());
    }
    sOhmSupply = sOhmSupply.plus(toDecimal(contractV3.circulatingSupply(), 9));
  } else if (blockNumber.gt(BigInt.fromString(ERC20_SOHM_V2_BLOCK))) {
    const contractV2 = getSOlympusERC20V2("sOHM V2", ERC20_SOHM_V2, blockNumber);
    if (!contractV2) {
      throw new Error("Expected to be able to bind to sOHM V2 at block " + blockNumber.toString());
    }
    sOhmSupply = sOhmSupply.plus(toDecimal(contractV2.circulatingSupply(), 9));
  } else {
    const contractV1 = getSOlympusERC20("sOHM", ERC20_SOHM_V1, blockNumber);
    if (!contractV1) {
      throw new Error("Expected to be able to bind to sOHM V1 at block " + blockNumber.toString());
    }
    sOhmSupply = sOhmSupply.plus(toDecimal(contractV1.circulatingSupply(), 9));
  }

  return sOhmSupply;
}

/**
 * Returns the total value locked (TVL) into the protocol, which is calculated as the
 * circulating supply of sOHM (sOHM being a staked token is locked) multiplied by the
 * OHM-USD price.
 *
 * @param blockNumber the current block number
 * @returns BigDecimal representing the TVL at the current block
 */
export function getTotalValueLocked(blockNumber: BigInt): BigDecimal {
  return getSOhmCirculatingSupply(blockNumber).times(getBaseOhmUsdRate(blockNumber));
}
