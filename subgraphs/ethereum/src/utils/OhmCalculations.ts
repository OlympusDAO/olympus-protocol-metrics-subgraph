import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { toDecimal } from "../../../shared/src/utils/Decimals";
import { BondManager } from "../../generated/ProtocolMetrics/BondManager";
import { sOlympusERC20V3 } from "../../generated/ProtocolMetrics/sOlympusERC20V3";
import { GnosisAuction, GnosisAuctionRoot, TokenSupply } from "../../generated/schema";
import { getOrCreateERC20TokenSnapshot } from "../contracts/ERC20";
import { GNOSIS_RECORD_ID } from "../GnosisAuction";
import { getBalancerPoolTokenQuantity } from "../liquidity/LiquidityBalancer";
import { getCurvePairTokenQuantityRecords } from "../liquidity/LiquidityCurve";
import { getFraxSwapPairTokenQuantityRecords } from "../liquidity/LiquidityFraxSwap";
import { getUniswapV2PairTokenQuantity } from "../liquidity/LiquidityUniswapV2";
import { pushTokenSupplyArray } from "./ArrayHelper";
import {
  BOND_MANAGER,
  CIRCULATING_SUPPLY_WALLETS,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_OHM_V2_BLOCK,
  ERC20_SOHM_V1,
  ERC20_SOHM_V2,
  ERC20_SOHM_V2_BLOCK,
  ERC20_SOHM_V3,
  ERC20_SOHM_V3_BLOCK,
  EULER_DEPLOYMENTS,
  getContractName,
  LIQUIDITY_OWNED,
  MIGRATION_CONTRACT,
  SILO_DEPLOYMENTS,
} from "./Constants";
import {
  getERC20DecimalBalance,
  getSOlympusERC20,
  getSOlympusERC20V2,
  getSOlympusERC20V3,
} from "./ContractHelper";
import { LendingMarketDeployment } from "./LendingMarketDeployment";
import { PairHandlerTypes } from "./PairHandler";
import { getUSDRate } from "./Price";
import {
  createOrUpdateTokenSupply,
  TYPE_BONDS_DEPOSITS,
  TYPE_BONDS_PREMINTED,
  TYPE_BONDS_VESTING_DEPOSITS,
  TYPE_BONDS_VESTING_TOKENS,
  TYPE_LENDING,
  TYPE_LIQUIDITY,
  TYPE_OFFSET,
  TYPE_TOTAL_SUPPLY,
  TYPE_TREASURY,
} from "./TokenSupplyHelper";

const MIGRATION_OFFSET_STARTING_BLOCK = "14381564";
const MIGRATION_OFFSET = "2013";

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

  const snapshot = getOrCreateERC20TokenSnapshot(ohmContractAddress, blockNumber);
  const snapshotTotalSupply = snapshot.totalSupply;

  if (snapshotTotalSupply === null) {
    log.error(
      "Expected to be able to bind to OHM contract at address {} for block {}, but it was not found.",
      [ohmContractAddress, blockNumber.toString()],
    );
    return BigDecimal.fromString("0");
  }

  return snapshotTotalSupply;
}

export function getTotalSupplyRecord(timestamp: BigInt, blockNumber: BigInt): TokenSupply {
  const ohmContractAddress = blockNumber.gt(BigInt.fromString(ERC20_OHM_V2_BLOCK))
    ? ERC20_OHM_V2
    : ERC20_OHM_V1;

  const totalSupply = getTotalSupply(blockNumber);

  return createOrUpdateTokenSupply(
    timestamp,
    getContractName(ohmContractAddress),
    ohmContractAddress,
    null,
    null,
    null,
    null,
    TYPE_TOTAL_SUPPLY,
    totalSupply,
    blockNumber,
  );
}

/**
 * Returns TokenSupply record representing a manual offset in the migration contract.
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
function getMigrationOffsetRecord(timestamp: BigInt, blockNumber: BigInt): TokenSupply | null {
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

  return createOrUpdateTokenSupply(
    timestamp,
    getContractName(ERC20_OHM_V2),
    ERC20_OHM_V2,
    null,
    null,
    getContractName(MIGRATION_CONTRACT),
    MIGRATION_CONTRACT,
    TYPE_OFFSET,
    offset,
    blockNumber,
    -1, // Will be subtracted
  );
}

export function getVestingBondSupplyRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const FUNC = "getVestingBondSupplyRecords";
  const records: TokenSupply[] = [];

  const gnosisAuctionRoot: GnosisAuctionRoot | null = GnosisAuctionRoot.load(GNOSIS_RECORD_ID);
  // Record will not exist if no auctions have been launched
  if (!gnosisAuctionRoot) {
    log.debug("{}: No auctions", [FUNC]);
    return records;
  }

  // Set up the FixedExpiryTeller and GnosisEasyAuction
  const bondManager = BondManager.bind(Address.fromString(BOND_MANAGER));
  if (!bondManager.isActive()) {
    log.debug("{}: Bond Manager not active", [FUNC]);
    return records;
  }

  const bondFixedExpiryTellerAddress = bondManager.fixedExpiryTeller();

  // Loop through Gnosis Auctions
  const gnosisAuctionIds: BigInt[] = gnosisAuctionRoot.markets;
  for (let i = 0; i < gnosisAuctionIds.length; i++) {
    const auctionId = gnosisAuctionIds[i].toString();
    log.debug("{}: Processing Gnosis auction with id {}", [FUNC, auctionId]);

    const auctionRecord = GnosisAuction.load(auctionId);
    if (!auctionRecord) {
      throw new Error(`Expected to find GnosisAuction record with id ${auctionId}, but it was not found`);
    }

    const bidQuantity: BigDecimal | null = auctionRecord.bidQuantity;

    // If the auction is open
    if (!bidQuantity) {
      log.debug("{}: auction is open", [FUNC]);

      // OHM equivalent to the auction capacity is pre-minted and stored in the teller
      records.push(
        createOrUpdateTokenSupply(
          timestamp,
          getContractName(ERC20_OHM_V2),
          ERC20_OHM_V2,
          auctionId, // auction ID in place of the pool name. Keeps values distinct for different auctions.
          null,
          getContractName(bondFixedExpiryTellerAddress.toHexString()),
          bondFixedExpiryTellerAddress.toHexString(),
          TYPE_BONDS_PREMINTED,
          auctionRecord.payoutCapacity,
          blockNumber,
          -1, // Subtract
        ),
      );
    }
    // If the auction is closed
    else {
      log.debug("{}: auction is closed", [FUNC]);
      const bondTermSeconds = auctionRecord.termSeconds;
      const auctionCloseTimestamp = auctionRecord.auctionCloseTimestamp;
      if (!auctionCloseTimestamp) {
        throw new Error(`Expected the auctionCloseTimestamp on closed auction '${auctionId}' to be set`);
      }

      const expiryTimestamp = auctionCloseTimestamp.plus(bondTermSeconds);

      // Closed auction and the bond expiry time has not been reached
      if (timestamp.lt(expiryTimestamp)) {
        // Vesting user deposits equal to the sold quantity are stored in the bond manager, so we adjust that
        records.push(
          createOrUpdateTokenSupply(
            timestamp,
            getContractName(ERC20_OHM_V2),
            ERC20_OHM_V2,
            auctionId, // auction ID in place of the pool name. Keeps values distinct for different auctions.
            null,
            getContractName(BOND_MANAGER),
            BOND_MANAGER,
            TYPE_BONDS_VESTING_DEPOSITS,
            bidQuantity,
            blockNumber,
            -1, // Subtract
          ),
        );

        // Vesting bond tokens equal to the auction capacity are stored in the teller, so we adjust that
        records.push(
          createOrUpdateTokenSupply(
            timestamp,
            getContractName(ERC20_OHM_V2),
            ERC20_OHM_V2,
            auctionId, // auction ID in place of the pool name. Keeps values distinct for different auctions.
            null,
            getContractName(bondFixedExpiryTellerAddress.toHexString()),
            bondFixedExpiryTellerAddress.toHexString(),
            TYPE_BONDS_VESTING_TOKENS,
            auctionRecord.payoutCapacity,
            blockNumber,
            -1, // Subtract
          ),
        );
      }
      // Bond expiry time has been reached
      else {
        // User deposits equal to the sold quantity are stored in the bond manager, so we adjust that
        // These deposits will eventually be burned
        records.push(
          createOrUpdateTokenSupply(
            timestamp,
            getContractName(ERC20_OHM_V2),
            ERC20_OHM_V2,
            auctionId, // auction ID in place of the pool name. Keeps values distinct for different auctions.
            null,
            getContractName(BOND_MANAGER),
            BOND_MANAGER,
            TYPE_BONDS_DEPOSITS,
            bidQuantity,
            blockNumber,
            -1, // Subtract
          ),
        );
      }

      // TODO add support for recognising OHM burned from bond deposits
    }
  }

  return records;
}

function getLendingMarketDeploymentOHMRecords(timestamp: BigInt, deployments: LendingMarketDeployment[], blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  for (let i = 0; i < deployments.length; i++) {
    const currentDeployment = deployments[i];
    // Exclude if before deployment
    if (blockNumber.lt(currentDeployment.getBlockNumber())) {
      continue;
    }

    // Exclude if not OHM
    if (currentDeployment.getToken().toLowerCase() != ERC20_OHM_V2.toLowerCase()) {
      continue;
    }

    records.push(
      createOrUpdateTokenSupply(
        timestamp,
        getContractName(ERC20_OHM_V2),
        ERC20_OHM_V2,
        null,
        null,
        getContractName(currentDeployment.getAddress()),
        currentDeployment.getAddress(),
        TYPE_LENDING,
        currentDeployment.getAmount(),
        blockNumber,
        -1, // Subtract
      )
    );
  }

  return records;
}

/**
 * Generates TokenSupply records for OHM that has been minted
 * and deposited into the Euler and Silo lending markets.
 * 
 * The values and block(s) are hard-coded, as this was performed manually using
 * the multi-sig. Future deployments will be automated through a smart contract.
 * 
 * @param timestamp 
 * @param blockNumber 
 * @returns 
 */
export function getMintedBorrowableOHMRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  pushTokenSupplyArray(
    records,
    getLendingMarketDeploymentOHMRecords(timestamp, SILO_DEPLOYMENTS, blockNumber),
  );

  pushTokenSupplyArray(
    records,
    getLendingMarketDeploymentOHMRecords(timestamp, EULER_DEPLOYMENTS, blockNumber),
  );

  return records;
}

/**
 * Returns the circulating supply of the latest version of the OHM contract
 * at the given block number.
 *
 * Circulating supply is defined as:
 * - OHM total supply
 * - subtract: OHM in {CIRCULATING_SUPPLY_WALLETS} (treasury, bonds, migration contract, DAO wallet, lending markets)
 * - subtract: migration offset
 *
 * @param blockNumber the current block number
 * @param totalSupply the total supply of OHM
 * @returns BigDecimal representing the circulating supply at the time of the block
 */
export function getTreasuryOHMRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const isV2Contract = blockNumber.gt(BigInt.fromString(ERC20_OHM_V2_BLOCK));
  const ohmContractAddress = isV2Contract ? ERC20_OHM_V2 : ERC20_OHM_V1;
  const records: TokenSupply[] = [];

  for (let i = 0; i < CIRCULATING_SUPPLY_WALLETS.length; i++) {
    const currentWallet = CIRCULATING_SUPPLY_WALLETS[i];
    const balance = getERC20DecimalBalance(ohmContractAddress, currentWallet, blockNumber);
    if (balance.equals(BigDecimal.zero())) continue;

    records.push(
      createOrUpdateTokenSupply(
        timestamp,
        getContractName(ohmContractAddress),
        ohmContractAddress,
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

  // gOHM
  // const ohmIndex: BigDecimal = getCurrentIndex(blockNumber);
  // for (let i = 0; i < CIRCULATING_SUPPLY_WALLETS.length; i++) {
  //   const currentWallet = CIRCULATING_SUPPLY_WALLETS[i];
  //   const balance = getERC20DecimalBalance(ERC20_GOHM, currentWallet, blockNumber);
  //   if (balance.equals(BigDecimal.zero())) continue;

  //   // Derive the OHM balance
  //   const ohmBalance = ohmIndex.times(balance);

  //   records.push(
  //     createOrUpdateTokenSupply(
  //       timestamp,
  //       `${getContractName(ERC20_OHM_V2)} in gOHM`,
  //       ERC20_OHM_V2,
  //       null,
  //       null,
  //       getContractName(currentWallet),
  //       currentWallet,
  //       TYPE_TREASURY,
  //       ohmBalance,
  //       blockNumber,
  //       -1, // Subtract
  //     ),
  //   );
  // }

  // Migration offset
  const migrationOffsetRecord = getMigrationOffsetRecord(timestamp, blockNumber);
  if (migrationOffsetRecord) {
    records.push(migrationOffsetRecord);
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

        pushTokenSupplyArray(
          records,
          getBalancerPoolTokenQuantity(
            timestamp,
            pairAddress,
            pairPoolAddress,
            ohmTokenAddress,
            blockNumber,
          ),
        );
      } else if (pairHandler.getType() == PairHandlerTypes.Curve) {
        pushTokenSupplyArray(
          records,
          getCurvePairTokenQuantityRecords(timestamp, pairAddress, ohmTokenAddress, blockNumber),
        );
      } else if (pairHandler.getType() == PairHandlerTypes.UniswapV2) {
        pushTokenSupplyArray(
          records,
          getUniswapV2PairTokenQuantity(timestamp, pairAddress, ohmTokenAddress, blockNumber),
        );
      } else if (pairHandler.getType() == PairHandlerTypes.FraxSwap) {
        pushTokenSupplyArray(
          records,
          getFraxSwapPairTokenQuantityRecords(timestamp, pairAddress, ohmTokenAddress, blockNumber),
        );
      } else {
        throw new Error("Unsupported pair type: " + pairHandler.getType().toString());
      }
    }
  }

  return records;
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
  return getSOhmCirculatingSupply(blockNumber).times(getUSDRate(ERC20_OHM_V2, blockNumber));
}

/**
 * For a given array of TokenSupply records (assumed to be at the same point in time),
 * this function returns the OHM backed supply.
 *
 * Backed supply is the quantity of OHM backed by treasury assets.
 * 
 * Backed supply is calculated as:
 * - OHM total supply
 * - minus: OHM in circulating supply wallets
 * - minus: migration offset
 * - minus: pre-minted OHM for bonds
 * - minus: OHM user deposits for bonds
 * - minus: protocol-owned OHM in liquidity pools
 * - minus: OHM minted and deployed into lending markets
 */
export function getBackedSupply(tokenSupplies: TokenSupply[]): BigDecimal {
  let total = BigDecimal.zero();

  const includedTypes = [TYPE_TOTAL_SUPPLY, TYPE_TREASURY, TYPE_OFFSET, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_DEPOSITS, TYPE_LIQUIDITY, TYPE_LENDING];

  for (let i = 0; i < tokenSupplies.length; i++) {
    const tokenSupply = tokenSupplies[i];

    if (!includedTypes.includes(tokenSupply.type)) {
      continue;
    }

    total = total.plus(tokenSupply.supplyBalance);
  }

  return total;
}

/**
 * For a given array of TokenSupply records (assumed to be at the same point in time),
 * this function returns the OHM floating supply.
 *
 * Floating supply is defined as:
 * - OHM total supply
 * - minus: OHM in circulating supply wallets
 * - minus: migration offset
 * - minus: pre-minted OHM for bonds
 * - minus: OHM user deposits for bonds
 * - minus: protocol-owned OHM in liquidity pools
 */
export function getFloatingSupply(tokenSupplies: TokenSupply[]): BigDecimal {
  let total = BigDecimal.zero();

  const includedTypes = [TYPE_TOTAL_SUPPLY, TYPE_TREASURY, TYPE_OFFSET, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_DEPOSITS, TYPE_LIQUIDITY];

  for (let i = 0; i < tokenSupplies.length; i++) {
    const tokenSupply = tokenSupplies[i];

    if (!includedTypes.includes(tokenSupply.type)) {
      continue;
    }

    total = total.plus(tokenSupply.supplyBalance);
  }

  return total;
}

/**
 * For a given array of TokenSupply records (assumed to be at the same point in time),
 * this function returns the OHM circulating supply.
 *
 * Circulating supply is defined as:
 * - OHM total supply
 * - minus: OHM in circulating supply wallets
 * - minus: migration offset
 * - minus: pre-minted OHM for bonds
 * - minus: OHM user deposits for bonds
 */
export function getCirculatingSupply(tokenSupplies: TokenSupply[]): BigDecimal {
  let total = BigDecimal.zero();

  const includedTypes = [TYPE_TOTAL_SUPPLY, TYPE_TREASURY, TYPE_OFFSET, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_DEPOSITS];

  for (let i = 0; i < tokenSupplies.length; i++) {
    const tokenSupply = tokenSupplies[i];

    if (!includedTypes.includes(tokenSupply.type)) {
      continue;
    }

    total = total.plus(tokenSupply.supplyBalance);
  }

  return total;
}
