import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import {
  BONDS_DEPOSIT,
  DAO_WALLET,
  MIGRATION_CONTRACT,
  ERC20_OHM,
  ERC20_OHM_V2,
  ERC20_OHM_V2_BLOCK,
  ERC20_SOHM,
  ERC20_SOHM_V2,
  ERC20_SOHM_V3,
} from "./Constants";
import {
  getERC20,
  getERC20Balance,
  getSOlympusERC20,
  getSOlympusERC20V2,
  getSOlympusERC20V3,
} from "./ContractHelper";
import { toDecimal } from "./Decimals";
import { getBaseOHMUSDRate } from "./Price";

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
    : ERC20_OHM;

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
 * Prior to the block `OHMV2_ERC20_CONTRACT_BLOCK` (13782589), circulating supply is defined as:
 * - OHM V1 total supply
 * - subtract: OHM V1 in DAO wallet
 * - subtract: OHM V1 in migration contract
 *
 * Afterwards, circulating supply is defined as:
 * - OHM V2 total supply
 * - subtract: OHM V2 in DAO wallet
 * - subtract: OHM V2 in migration contract
 * - subtract: OHM V2 in bonds deposit
 *
 * @param blockNumber the current block number
 * @param totalSupply the total supply of OHM
 * @returns BigDecimal representing the total supply at the time of the block
 */
export function getCirculatingSupply(blockNumber: BigInt, totalSupply: BigDecimal): BigDecimal {
  const isV2Contract = blockNumber.gt(BigInt.fromString(ERC20_OHM_V2_BLOCK));
  const ohmContractAddress = isV2Contract ? ERC20_OHM_V2 : ERC20_OHM;

  const ohmContract = getERC20("OHM", ohmContractAddress, blockNumber);

  if (!ohmContract) {
    log.error(
      "Expected to be able to bind to OHM contract at address {} for block {}, but it was not found.",
      [ohmContractAddress, blockNumber.toString()],
    );
    return BigDecimal.fromString("0");
  }

  let circulatingSupply = totalSupply;

  circulatingSupply = circulatingSupply.minus(
    toDecimal(getERC20Balance(ohmContract, DAO_WALLET, blockNumber), 9),
  );
  circulatingSupply = circulatingSupply.minus(
    toDecimal(getERC20Balance(ohmContract, MIGRATION_CONTRACT, blockNumber), 9),
  );

  if (isV2Contract) {
    circulatingSupply = circulatingSupply.minus(
      toDecimal(getERC20Balance(ohmContract, BONDS_DEPOSIT, blockNumber), 9),
    );
  }

  return circulatingSupply;
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
  return getBaseOHMUSDRate(blockNumber).times(
    getCirculatingSupply(blockNumber, getTotalSupply(blockNumber)),
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
  const contractV1 = getSOlympusERC20("sOHM", ERC20_SOHM, blockNumber);
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
  return getSOhmCirculatingSupply(blockNumber).times(getBaseOHMUSDRate(blockNumber));
}
