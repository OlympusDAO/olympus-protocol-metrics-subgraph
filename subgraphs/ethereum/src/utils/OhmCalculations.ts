import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenSupply } from "../../../shared/generated/schema";
import { getCurrentIndex } from "../../../shared/src/supply/OhmCalculations";
import { pushTokenSupplyArray } from "../../../shared/src/utils/ArrayHelper";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { LendingMarketDeployment } from "../../../shared/src/utils/LendingMarketDeployment";
import { createOrUpdateTokenSupply, TYPE_BONDS_DEPOSITS, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_VESTING_TOKENS, TYPE_BOOSTED_LIQUIDITY_VAULT, TYPE_LENDING, TYPE_LIQUIDITY, TYPE_OFFSET, TYPE_TOTAL_SUPPLY, TYPE_TREASURY } from "../../../shared/src/utils/TokenSupplyHelper";
import { OLYMPUS_ASSOCIATION_WALLET } from "../../../shared/src/Wallets";
import { BondManager } from "../../generated/ProtocolMetrics/BondManager";
import { IncurDebt } from "../../generated/ProtocolMetrics/IncurDebt";
import { OlympusBoostedLiquidityRegistry } from "../../generated/ProtocolMetrics/OlympusBoostedLiquidityRegistry";
import { OlympusBoostedLiquidityVaultLido } from "../../generated/ProtocolMetrics/OlympusBoostedLiquidityVaultLido";
import { sOlympusERC20V3 } from "../../generated/ProtocolMetrics/sOlympusERC20V3";
import { GnosisAuction, GnosisAuctionRoot } from "../../generated/schema";
import { getERC20Decimals, getOrCreateERC20TokenSnapshot } from "../contracts/ERC20";
import { GNOSIS_RECORD_ID } from "../GnosisAuction";
import { getBalancerPoolTokenQuantity } from "../liquidity/LiquidityBalancer";
import { getCurvePairTokenQuantityRecords } from "../liquidity/LiquidityCurve";
import { getFraxSwapPairTokenQuantityRecords } from "../liquidity/LiquidityFraxSwap";
import { getUniswapV2PairTokenQuantity } from "../liquidity/LiquidityUniswapV2";
import {
  BOND_MANAGER,
  CIRCULATING_SUPPLY_WALLETS,
  ERC20_GOHM,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_OHM_V2_BLOCK,
  ERC20_SOHM_V1,
  ERC20_SOHM_V2,
  ERC20_SOHM_V2_BLOCK,
  ERC20_SOHM_V3,
  ERC20_SOHM_V3_BLOCK,
  EULER_ADDRESS,
  EULER_DEPLOYMENTS,
  getContractName,
  LIQUIDITY_OWNED,
  MIGRATION_CONTRACT,
  OLYMPUS_BOOSTED_LIQUIDITY_REGISTRY,
  OLYMPUS_INCUR_DEBT,
  SILO_ADDRESS,
  SILO_DEPLOYMENTS,
} from "./Constants";
import {
  getERC20DecimalBalance,
  getSOlympusERC20,
  getSOlympusERC20V2,
  getSOlympusERC20V3,
} from "./ContractHelper";
import { PairHandlerTypes } from "./PairHandler";
import { getUSDRate } from "./Price";

const MIGRATION_OFFSET_STARTING_BLOCK = "14381564";
const MIGRATION_OFFSET = "2013";

/**
 * The block from which the wallet of the Olympus Association
 * was removed from the definition of protocol- and DAO-owned wallets.
 */
const OLYMPUS_ASSOCIATION_BLOCK = "17115000";

/**
 * The block from which gOHM in protocol- and DAO-owned wallets
 * was considered.
 */
const GOHM_INDEXING_BLOCK = "17115000";

/**
 * The block from which the inclusion of BLV in floating and circulating supply
 * was changed.
 */
const BLV_INCLUSION_BLOCK = "17620000";

/**
 * The block from which IncurDebt is being indexed. This is to avoid changing
 * the historical values.
 */
const OLYMPUS_INCUR_DEBT_BLOCK = "17620000";

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
 * NOTE: the balance of gOHM in the migration contract is likely to be higher than this manual offset,
 * as it is gOHM pre-minted for migration of OHM (v1). As a result, the difference in the gOHM balance is not considered protocol-owned.
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

function getLendingMarketDeploymentOHMRecords(timestamp: BigInt, deploymentAddress: string, deployments: LendingMarketDeployment[], blockNumber: BigInt): TokenSupply[] {
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
    if (currentDeployment.getToken().toLowerCase() != ERC20_OHM_V2.toLowerCase()) {
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
      getContractName(ERC20_OHM_V2),
      ERC20_OHM_V2,
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
    getLendingMarketDeploymentOHMRecords(timestamp, SILO_ADDRESS, SILO_DEPLOYMENTS, blockNumber),
  );

  pushTokenSupplyArray(
    records,
    getLendingMarketDeploymentOHMRecords(timestamp, EULER_ADDRESS, EULER_DEPLOYMENTS, blockNumber),
  );

  return records;
}

/**
 * Returns the supply of protocol- and DAO-owned OHM at the given block number.
 *
 * sOHM and gOHM are converted to the equivalent quantity of OHM (using the index)
 * and included in the calculation.
 *
 * @param timestamp the current timestamp
 * @param blockNumber the current block number
 * @returns TokenSupply records
 */
export function getTreasuryOHMRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const isV2Contract = blockNumber.gt(BigInt.fromString(ERC20_OHM_V2_BLOCK));
  const ohmContractAddress = isV2Contract ? ERC20_OHM_V2 : ERC20_OHM_V1;
  const records: TokenSupply[] = [];

  /**
   * Make a copy of the circulating wallets array
   * 
   * NOTE: this deliberately does not use the `getWalletAddressesForContract` function, 
   * as that blacklists all OHM variants in treasury wallets, so that they are not added
   * to the market value
   */
  const wallets = new Array<string>();
  for (let i = 0; i < CIRCULATING_SUPPLY_WALLETS.length; i++) {
    wallets.push(CIRCULATING_SUPPLY_WALLETS[i]);
  }

  // Add the Olympus Association wallet if before the milestone
  if (blockNumber.lt(BigInt.fromString(OLYMPUS_ASSOCIATION_BLOCK))) {
    wallets.push(OLYMPUS_ASSOCIATION_WALLET);
  }

  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
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

  // Index sOHM and gOHM if after the milestone
  if (blockNumber.ge(BigInt.fromString(GOHM_INDEXING_BLOCK))) {
    const ohmIndex: BigDecimal = getCurrentIndex(blockNumber);

    // sOHM
    for (let i = 0; i < wallets.length; i++) {
      const currentWallet = wallets[i];

      const balance = getERC20DecimalBalance(ERC20_SOHM_V3, currentWallet, blockNumber);
      if (balance.equals(BigDecimal.zero())) continue;

      // Derive the OHM balance
      const ohmBalance = ohmIndex.times(balance);

      records.push(
        createOrUpdateTokenSupply(
          timestamp,
          `${getContractName(ERC20_OHM_V2)} in sOHM v3`,
          ERC20_OHM_V2,
          null,
          null,
          getContractName(currentWallet),
          currentWallet,
          TYPE_TREASURY,
          ohmBalance,
          blockNumber,
          -1, // Subtract
        ),
      );
    }

    // gOHM
    for (let i = 0; i < wallets.length; i++) {
      const currentWallet = wallets[i];
      const balance = getERC20DecimalBalance(ERC20_GOHM, currentWallet, blockNumber);
      if (balance.equals(BigDecimal.zero())) continue;

      // Derive the OHM balance
      const ohmBalance = ohmIndex.times(balance);

      records.push(
        createOrUpdateTokenSupply(
          timestamp,
          `${getContractName(ERC20_OHM_V2)} in gOHM`,
          ERC20_OHM_V2,
          null,
          null,
          getContractName(currentWallet),
          currentWallet,
          TYPE_TREASURY,
          ohmBalance,
          blockNumber,
          -1, // Subtract
        ),
      );
    }
  }

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
 * Returns TokenSupply records representing the OHM minted into the IncurDebt contract.
 * 
 * The value reported for each vault is based on the value of `totalOutstandingGlobalDebt()`.
 * 
 * Only applicable after `OLYMPUS_INCUR_DEBT_BLOCK`
 * 
 * @param timestamp 
 * @param blockNumber 
 * @returns 
 */
export function getIncurDebtSupplyRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  // Don't apply retro-actively
  if (blockNumber.lt(BigInt.fromString(OLYMPUS_INCUR_DEBT_BLOCK))) {
    return records;
  }

  const incurDebtContract = IncurDebt.bind(Address.fromString(OLYMPUS_INCUR_DEBT));

  // Get the outstanding debt in OHM
  const outstandingDebtResult = incurDebtContract.try_totalOutstandingGlobalDebt();
  if (outstandingDebtResult.reverted) {
    return records;
  }

  // Create a TokenSupply record
  const ohmDecimals = getERC20Decimals(ERC20_OHM_V2, blockNumber);
  const outstandingDebt = toDecimal(outstandingDebtResult.value, ohmDecimals);

  records.push(
    createOrUpdateTokenSupply(
      timestamp,
      getContractName(ERC20_OHM_V2),
      ERC20_OHM_V2,
      null,
      null,
      getContractName(OLYMPUS_INCUR_DEBT),
      OLYMPUS_INCUR_DEBT,
      TYPE_BOOSTED_LIQUIDITY_VAULT, // Analogous to OHM in BLV
      outstandingDebt,
      blockNumber,
      -1, // Subtract
    ),
  );

  return records;
}

/**
 * Returns TokenSupply records representing the OHM minted into boosted liquidity vaults.
 * 
 * The value reported for each vault is the result of calling `getPoolOhmShare()`.
 * 
 * @param timestamp 
 * @param blockNumber 
 * @returns 
 */
export function getBoostedLiquiditySupplyRecords(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  // For each vault registry
  const liquidityRegistry = OlympusBoostedLiquidityRegistry.bind(Address.fromString(OLYMPUS_BOOSTED_LIQUIDITY_REGISTRY));
  const activeVaultsCountResult = liquidityRegistry.try_activeVaultCount();
  if (activeVaultsCountResult.reverted) {
    return records;
  }

  const ohmDecimals = getERC20Decimals(ERC20_OHM_V2, blockNumber);

  // Get vaults
  const activeVaultsCount = activeVaultsCountResult.value.toI32();
  for (let i = 0; i < activeVaultsCount; i++) {
    const vaultAddress = liquidityRegistry.activeVaults(BigInt.fromI32(i));
    const vault = OlympusBoostedLiquidityVaultLido.bind(vaultAddress);

    // Get the OHM share in the LP
    const ohmInPool = vault.getPoolOhmShare();
    const ohmInPoolDecimal = toDecimal(ohmInPool, ohmDecimals);
    if (ohmInPoolDecimal.equals(BigDecimal.zero())) {
      continue;
    }

    records.push(
      createOrUpdateTokenSupply(
        timestamp,
        getContractName(ERC20_OHM_V2),
        ERC20_OHM_V2,
        null,
        null,
        `Boosted Liquidity Vault - ${vaultAddress.toHexString()}`, // Avoids record clobbering. The address comes from the registry, so cannot be recorded in advance.
        vaultAddress.toHexString().toLowerCase(),
        TYPE_BOOSTED_LIQUIDITY_VAULT,
        ohmInPoolDecimal,
        blockNumber,
        -1, // Subtract
      ),
    );
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
 * - minus: OHM in boosted liquidity vaults
 * - minus: OHM minted and deployed into lending markets
 */
export function getBackedSupply(tokenSupplies: TokenSupply[], block: BigInt): BigDecimal {
  let total = BigDecimal.zero();

  const includedTypes = [TYPE_TOTAL_SUPPLY, TYPE_TREASURY, TYPE_OFFSET, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_DEPOSITS, TYPE_LIQUIDITY, TYPE_BOOSTED_LIQUIDITY_VAULT, TYPE_LENDING];

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
 * Prior to `BLV_INCLUSION_BLOCK`, OHM minted into boosted liquidity vaults was deducted from total supply,
 * which meant that floating & circulating supply excluded BLV OHM. This was changed to include BLV OHM in floating and circulating supply.
 */
function isBLVIncluded(block: BigInt): boolean {
  return block.lt(BigInt.fromString(BLV_INCLUSION_BLOCK));
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
 * - minus: OHM in boosted liquidity vaults (before `BLV_INCLUSION_BLOCK`)
 */
export function getFloatingSupply(tokenSupplies: TokenSupply[], block: BigInt): BigDecimal {
  let total = BigDecimal.zero();

  const includedTypes = [TYPE_TOTAL_SUPPLY, TYPE_TREASURY, TYPE_OFFSET, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_DEPOSITS, TYPE_LIQUIDITY];

  if (isBLVIncluded(block)) {
    includedTypes.push(TYPE_BOOSTED_LIQUIDITY_VAULT);
  }

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
 * - minus: OHM in boosted liquidity vaults (before `BLV_INCLUSION_BLOCK`)
 * 
 * OHM represented by vesting bond tokens (type `TYPE_BONDS_VESTING_TOKENS`) is not included in the circulating supply, as it is
 * owned by users and not the protocol.
 */
export function getCirculatingSupply(tokenSupplies: TokenSupply[], block: BigInt): BigDecimal {
  let total = BigDecimal.zero();

  const includedTypes = [TYPE_TOTAL_SUPPLY, TYPE_TREASURY, TYPE_OFFSET, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_DEPOSITS];

  if (isBLVIncluded(block)) {
    includedTypes.push(TYPE_BOOSTED_LIQUIDITY_VAULT);
  }

  for (let i = 0; i < tokenSupplies.length; i++) {
    const tokenSupply = tokenSupplies[i];

    if (!includedTypes.includes(tokenSupply.type)) {
      continue;
    }

    total = total.plus(tokenSupply.supplyBalance);
  }

  return total;
}
