import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecords } from "../../generated/schema";
import {
  BONDS_DEPOSIT,
  BONDS_INVERSE_DEPOSIT,
  DAO_WALLET,
  ERC20_OHM_V1,
  ERC20_OHM_V2,
  ERC20_OHM_V2_BLOCK,
  ERC20_SOHM_V1,
  ERC20_SOHM_V2,
  ERC20_SOHM_V3,
  getContractName,
  LIQUIDITY_OWNED,
  MIGRATION_CONTRACT,
  TREASURY_ADDRESS_V1,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
} from "./Constants";
import {
  getERC20,
  getERC20Balance,
  getSOlympusERC20,
  getSOlympusERC20V2,
  getSOlympusERC20V3,
} from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getBaseOhmUsdRate } from "./Price";
import {
  combineTokenRecords,
  newTokenRecord,
  newTokenRecords,
  pushTokenRecord,
  setTokenRecordsMultiplier,
} from "./TokenRecordHelper";

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

  const ohmContract = getERC20("OHM", ohmContractAddress, blockNumber);

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
 * Returns the circulating supply of the latest version of the OHM contract
 * at the given block number.
 *
 * Circulating supply is defined as:
 * - OHM total supply
 * - subtract: OHM in DAO wallet
 * - subtract: OHM in migration contract
 * - subtract: OHM in bonds deposit
 * - subtract: OHM in inverse bonds deposit
 * - subtract: OHM in treasury wallets
 *
 * @param blockNumber the current block number
 * @param totalSupply the total supply of OHM
 * @returns BigDecimal representing the total supply at the time of the block
 */
export function getCirculatingSupply(blockNumber: BigInt, totalSupply: BigDecimal): TokenRecords {
  const isV2Contract = blockNumber.gt(BigInt.fromString(ERC20_OHM_V2_BLOCK));
  const ohmContractAddress = isV2Contract ? ERC20_OHM_V2 : ERC20_OHM_V1;

  const ohmContract = getERC20("OHM", ohmContractAddress, blockNumber);
  const records = newTokenRecords("OHM Circulating Supply", blockNumber);

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
      getContractName(ohmContractAddress),
      ohmContractAddress,
      "OHM Total Supply",
      "N/A",
      BigDecimal.fromString("1"),
      totalSupply,
      blockNumber,
    ),
  );

  const wallets = [
    DAO_WALLET,
    MIGRATION_CONTRACT,
    BONDS_DEPOSIT,
    BONDS_INVERSE_DEPOSIT,
    TREASURY_ADDRESS_V1,
    TREASURY_ADDRESS_V2,
    TREASURY_ADDRESS_V3,
  ];
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balance = getERC20Balance(ohmContract, currentWallet, blockNumber);
    if (balance.equals(BigInt.zero())) continue;

    pushTokenRecord(
      records,
      newTokenRecord(
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

  return records;
}

/**
 * Returns the quantity of OHM in liquidity pools
 *
 * @param blockNumber
 * @returns
 */
function getLiquiditySupply(blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords("OHM Liquidity Supply", blockNumber);

  for (let i = 0; i < LIQUIDITY_OWNED.length; i++) {
    const pairHandler = LIQUIDITY_OWNED[i];
    const pairAddress = pairHandler.getContract();

    // We can just query the balance of the OHM token(s) in the pair address
    const ohmTokens = [ERC20_OHM_V1, ERC20_OHM_V2];
    for (let j = 0; j < ohmTokens.length; j++) {
      const ohmTokenAddress = ohmTokens[j];
      const ohmToken = getERC20(getContractName(ohmTokenAddress), ohmTokenAddress, blockNumber);
      if (!ohmToken) {
        throw new Error("Unable to bind ERC20 contract for OHM with address " + ohmTokenAddress);
      }

      const decimals = ohmToken.decimals();
      // This obtains the total amount of OHM in the LP
      const balance = ohmToken.balanceOf(Address.fromString(pairAddress));
      if (balance.equals(BigInt.zero())) continue;

      // TODO We need to calculate Olympus' ownership of the LP

      const balanceDecimal = toDecimal(balance, decimals);

      pushTokenRecord(
        records,
        newTokenRecord(
          getContractName(ohmTokenAddress),
          ohmTokenAddress,
          getContractName(pairAddress),
          pairAddress,
          BigDecimal.fromString("1"),
          balanceDecimal,
          blockNumber,
        ),
      );

      log.debug("Reserves of {} {} in pair {}", [
        balanceDecimal.toString(),
        getContractName(ohmTokenAddress),
        getContractName(pairAddress),
      ]);
    }
  }

  return records;
}

/**
 * The floating supply of OHM is defined as:
 * - circulating supply
 * - minus the quantity of OHM in liquidity pools
 *
 * @param totalSupply
 * @param blockNumber
 * @returns
 */
export function getFloatingSupply(totalSupply: BigDecimal, blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords("OHM Floating Supply", blockNumber);

  // Circulating supply
  combineTokenRecords(records, getCirculatingSupply(blockNumber, totalSupply));

  // Liquidity supply
  const liquiditySupply = getLiquiditySupply(blockNumber);
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
export function getOhmMarketcap(blockNumber: BigInt): BigDecimal {
  return getBaseOhmUsdRate(blockNumber).times(
    getCirculatingSupply(blockNumber, getTotalSupply(blockNumber)).value,
  );
}

/**
 * Returns the circulating supply of sOHM V1, V2 and V3.
 *
 * TODO: clarify whether this is correct. OHM circulating supply is not a total.
 *
 * @param blockNumber the current block number
 * @returns BigDecimal representing the total circulating supply at the current block
 */
export function getSOhmCirculatingSupply(blockNumber: BigInt): BigDecimal {
  const contractV1 = getSOlympusERC20("sOHM", ERC20_SOHM_V1, blockNumber);
  const contractV2 = getSOlympusERC20V2("sOHM V2", ERC20_SOHM_V2, blockNumber);
  const contractV3 = getSOlympusERC20V3("sOHM V3", ERC20_SOHM_V3, blockNumber);
  let sOhmSupply = BigDecimal.fromString("0");

  if (contractV1) {
    sOhmSupply = sOhmSupply.plus(toDecimal(contractV1.circulatingSupply(), 9));
  }

  if (contractV2) {
    sOhmSupply = sOhmSupply.plus(toDecimal(contractV2.circulatingSupply(), 9));
  }

  if (contractV3) {
    sOhmSupply = sOhmSupply.plus(toDecimal(contractV3.circulatingSupply(), 9));
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
