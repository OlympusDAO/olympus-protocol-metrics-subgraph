import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { ConvexAllocator } from "../../generated/ProtocolMetrics/ConvexAllocator";
import { ConvexBaseRewardPool } from "../../generated/ProtocolMetrics/ConvexBaseRewardPool";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { MasterChef } from "../../generated/ProtocolMetrics/MasterChef";
import { RariAllocator } from "../../generated/ProtocolMetrics/RariAllocator";
import { sOlympusERC20 } from "../../generated/ProtocolMetrics/sOlympusERC20";
import { sOlympusERC20V2 } from "../../generated/ProtocolMetrics/sOlympusERC20V2";
import { sOlympusERC20V3 } from "../../generated/ProtocolMetrics/sOlympusERC20V3";
import { StabilityPool } from "../../generated/ProtocolMetrics/StabilityPool";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import { VeFXS } from "../../generated/ProtocolMetrics/VeFXS";
import { TokenRecord, TokenRecords } from "../../generated/schema";
import {
  ALLOCATOR_CONVEX_FRAX_CONTRACTS,
  ALLOCATOR_LIQUITY_STABILITY_POOLS,
  ALLOCATOR_ONSEN_ID_NOT_FOUND,
  ALLOCATOR_RARI_ID_NOT_FOUND,
  CONTRACT_STARTING_BLOCK_MAP,
  CONVEX_STAKING_CONTRACTS,
  ERC20_FRAX,
  ERC20_FXS,
  ERC20_FXS_VE,
  getContractName,
  getLiquidityPairTokens,
  getLiquityAllocator,
  getOnsenAllocatorId,
  getRariAllocatorId,
  NATIVE_ETH,
  ONSEN_ALLOCATOR,
  RARI_ALLOCATOR,
  SUSHI_MASTERCHEF,
  VEFXS_ALLOCATOR,
  WALLET_ADDRESSES,
} from "./Constants";
import { toDecimal } from "./Decimals";
import { getUSDRate } from "./Price";
import { newTokenRecord, newTokenRecords, pushTokenRecord } from "./TokenRecordHelper";

/**
 * The Graph recommends only binding a contract once
 * AssemblyScript doesn't like union types, so we have
 * to statically-type these contract maps.
 */
const contractsERC20 = new Map<string, ERC20>();
const contractsSOlympusERC20 = new Map<string, sOlympusERC20>();
const contractsSOlympusERC20V2 = new Map<string, sOlympusERC20V2>();
const contractsSOlympusERC20V3 = new Map<string, sOlympusERC20V3>();
const contractsUniswapV2Pair = new Map<string, UniswapV2Pair>();
const contractsUniswapV3Pair = new Map<string, UniswapV3Pair>();
const contractsRariAllocator = new Map<string, RariAllocator>();
const contractsMasterChef = new Map<string, MasterChef>();
const contractsVeFXS = new Map<string, VeFXS>();
const contractsConvexAllocator = new Map<string, ConvexAllocator>();
const contractsStabilityPool = new Map<string, StabilityPool>();

// TODO shift to constants
/**
 * Indicates whether a contract exists at a given block number.
 *
 * This will check `CONTRACT_STARTING_BLOCK_MAP` for the presence
 * of the contract address at the given block number.
 *
 * If no starting block is defined, it is assumed that the
 * contract is present prior to the starting block of this subgraph
 * (currently 14000000).
 *
 * @param contractAddress
 * @param blockNumber
 */
function contractExistsAtBlock(contractAddress: string, blockNumber: BigInt): boolean {
  log.debug("Checking for starting block of contract {}", [contractAddress]);

  // Assuming the starting block is much earlier
  if (!CONTRACT_STARTING_BLOCK_MAP.has(contractAddress)) {
    log.debug("No starting block defined for contract {}. Assuming it is prior", [contractAddress]);
    return true;
  }

  const startingBlock: string = CONTRACT_STARTING_BLOCK_MAP.get(contractAddress) || "N/A";
  log.debug("Starting block for contract {}: {}", [contractAddress, startingBlock]);

  // Current block is before the starting block
  if (blockNumber < BigInt.fromString(startingBlock)) {
    log.debug("Current block is before the starting block. Skipping", []);
    return false;
  }

  return true;
}

export function getERC20(
  contractName: string,
  contractAddress: string,
  currentBlockNumber: BigInt,
): ERC20 | null {
  log.debug("Fetching ERC20 contract {} for address {}", [contractName, contractAddress]);
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  // We can't bind for native (non-ERC20) ETH
  if (contractAddress == NATIVE_ETH) return null;

  if (!contractsERC20.has(contractAddress)) {
    log.debug("Binding ERC20 contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = ERC20.bind(Address.fromString(contractAddress));
    contractsERC20.set(contractAddress, contract);
  }

  return contractsERC20.get(contractAddress);
}

export function getSOlympusERC20(
  contractName: string,
  contractAddress: string,
  currentBlockNumber: BigInt,
): sOlympusERC20 | null {
  log.debug("Fetching sOlympusERC20 contract {} for address {}", [contractName, contractAddress]);
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsSOlympusERC20.has(contractAddress)) {
    log.debug("Binding sOlympusERC20 contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = sOlympusERC20.bind(Address.fromString(contractAddress));
    contractsSOlympusERC20.set(contractAddress, contract);
  }

  return contractsSOlympusERC20.get(contractAddress);
}

export function getSOlympusERC20V2(
  contractName: string,
  contractAddress: string,
  currentBlockNumber: BigInt,
): sOlympusERC20V2 | null {
  log.debug("Fetching sOlympusERC20V2 contract {} for address {}", [contractName, contractAddress]);
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsSOlympusERC20V2.has(contractAddress)) {
    log.debug("Binding sOlympusERC20V2 contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = sOlympusERC20V2.bind(Address.fromString(contractAddress));
    contractsSOlympusERC20V2.set(contractAddress, contract);
  }

  return contractsSOlympusERC20V2.get(contractAddress);
}

export function getSOlympusERC20V3(
  contractName: string,
  contractAddress: string,
  currentBlockNumber: BigInt,
): sOlympusERC20V3 | null {
  log.debug("Fetching sOlympusERC20V3 contract {} for address {}", [contractName, contractAddress]);
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsSOlympusERC20V3.has(contractAddress)) {
    log.debug("Binding sOlympusERC20V3 contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = sOlympusERC20V3.bind(Address.fromString(contractAddress));
    contractsSOlympusERC20V3.set(contractAddress, contract);
  }

  return contractsSOlympusERC20V3.get(contractAddress);
}

export function getUniswapV2Pair(
  contractAddress: string,
  currentBlockNumber: BigInt,
): UniswapV2Pair | null {
  log.debug("Fetching UniswapV2Pair contract for address {}", [contractAddress]);
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsUniswapV2Pair.has(contractAddress)) {
    log.debug("Binding UniswapV2Pair contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = UniswapV2Pair.bind(Address.fromString(contractAddress));
    contractsUniswapV2Pair.set(contractAddress, contract);
  }

  return contractsUniswapV2Pair.get(contractAddress);
}

export function getUniswapV3Pair(
  contractAddress: string,
  currentBlockNumber: BigInt,
): UniswapV3Pair | null {
  log.debug("Fetching UniswapV3Pair contract for address {}", [contractAddress]);
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsUniswapV3Pair.has(contractAddress)) {
    log.debug("Binding UniswapV3Pair contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = UniswapV3Pair.bind(Address.fromString(contractAddress));
    contractsUniswapV3Pair.set(contractAddress, contract);
  }

  return contractsUniswapV3Pair.get(contractAddress);
}

export function getMasterChef(
  contractAddress: string,
  currentBlockNumber: BigInt,
): MasterChef | null {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsMasterChef.has(contractAddress)) {
    log.debug("Binding MasterChef contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = MasterChef.bind(Address.fromString(contractAddress));
    contractsMasterChef.set(contractAddress, contract);
  }

  return contractsMasterChef.get(contractAddress);
}

export function getRariAllocator(
  contractAddress: string,
  currentBlockNumber: BigInt,
): RariAllocator | null {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsRariAllocator.has(contractAddress)) {
    log.debug("Binding RariAllocator contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = RariAllocator.bind(Address.fromString(contractAddress));
    contractsRariAllocator.set(contractAddress, contract);
  }

  return contractsRariAllocator.get(contractAddress);
}

export function getVeFXS(contractAddress: string, currentBlockNumber: BigInt): VeFXS | null {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsVeFXS.has(contractAddress)) {
    log.debug("Binding VeFXS contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = VeFXS.bind(Address.fromString(contractAddress));
    contractsVeFXS.set(contractAddress, contract);
  }

  return contractsVeFXS.get(contractAddress);
}

export function getConvexAllocator(
  contractAddress: string,
  currentBlockNumber: BigInt,
): ConvexAllocator | null {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsConvexAllocator.has(contractAddress)) {
    log.debug("Binding ConvexAllocator contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = ConvexAllocator.bind(Address.fromString(contractAddress));
    contractsConvexAllocator.set(contractAddress, contract);
  }

  return contractsConvexAllocator.get(contractAddress);
}

export function getStabilityPool(
  contractAddress: string,
  currentBlockNumber: BigInt,
): StabilityPool | null {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsStabilityPool.has(contractAddress)) {
    log.debug("Binding StabilityPool contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = StabilityPool.bind(Address.fromString(contractAddress));
    contractsStabilityPool.set(contractAddress, contract);
  }

  return contractsStabilityPool.get(contractAddress);
}

/**
 * Helper method to simplify getting the balance from an ERC20 contract.
 *
 * Returns 0 if the minimum block number has not passed.
 *
 * @param contract The bound ERC20 contract.
 * @param address The address of the holder.
 * @param currentBlockNumber The current block number.
 * @param minimumBlockNumber The minimum block number for the balance to apply.
 * @returns BigInt
 */
export function getERC20Balance(
  contract: ERC20 | null,
  address: string,
  currentBlockNumber: BigInt,
): BigInt {
  if (!contract) {
    log.info("Contract for address {} does not exist at block {}", [
      address,
      currentBlockNumber.toString(),
    ]);
    return BigInt.fromString("0");
  }

  log.debug("Getting ERC20 balance in contract {} for wallet {} at block number {}", [
    contract._address.toHexString(),
    address,
    currentBlockNumber.toString(),
  ]);

  return contract.balanceOf(Address.fromString(address));
}

/**
 * Helper method to simplify getting the balance from an UniswapV2Pair contract.
 *
 * Returns 0 if {currentBlockNumber} has not passed.
 *
 * @param contract The bound UniswapV2Pair contract.
 * @param address The address of the holder.
 * @param currentBlockNumber The current block number.
 * @param tokenAddress Optional token address to filter the LP by.
 * @returns BigInt
 */
export function getUniswapV2PairBalance(
  contract: UniswapV2Pair | null,
  address: string,
  currentBlockNumber: BigInt,
  tokenAddress: string | null = null,
): BigInt {
  if (!contract) {
    log.info("Contract for address {} does not exist at block {}", [
      address,
      currentBlockNumber.toString(),
    ]);
    return BigInt.fromString("0");
  }

  if (
    tokenAddress &&
    !getLiquidityPairTokens(contract._address.toHexString()).includes(tokenAddress)
  ) {
    log.debug("Skipping UniswapV2Pair that does not match specified token address {}", [
      tokenAddress,
    ]);
    return BigInt.fromString("0");
  }

  log.debug("Getting UniswapV2Pair balance in contract {} for wallet {} at block number {}", [
    contract._address.toHexString(),
    address,
    currentBlockNumber.toString(),
  ]);

  return contract.balanceOf(Address.fromString(address));
}

/**
 * Helper method to simplify getting the balance from a MasterChef/Onsen contract.
 *
 * Returns 0 if the minimum block number has not passed or there is no matching Onsen ID.
 *
 * @param contract The bound MasterChef/Onsen contract.
 * @param allocatorAddress The address of the allocator.
 * @param blockNumber The current block number.
 * @returns BigDecimal or null
 */
export function getOnsenBalance(
  tokenAddress: string,
  allocatorAddress: string,
  blockNumber: BigInt,
): BigDecimal | null {
  const contract = getMasterChef(SUSHI_MASTERCHEF, blockNumber);
  if (!contract) {
    log.info("Contract for address {} does not exist at block {}", [
      allocatorAddress,
      blockNumber.toString(),
    ]);
    return null;
  }

  const onsenId = getOnsenAllocatorId(tokenAddress);
  if (onsenId === ALLOCATOR_ONSEN_ID_NOT_FOUND) {
    log.debug("No Onsen ID found for token {}. Skipping.", [tokenAddress]);
    return null;
  }

  return toDecimal(
    contract.userInfo(BigInt.fromI32(onsenId), Address.fromString(allocatorAddress)).value0,
    18,
  );
}

/**
 * Helper method to simplify getting the balance from a MasterChef contract.
 *
 * Returns 0 if the minimum block number has not passed.
 *
 * @param contract The bound MasterChef contract.
 * @param address The address of the holder.
 * @param onsenId The onsen ID to use.
 * @param currentBlockNumber The current block number.
 * @returns BigInt
 */
export function getMasterChefBalance(
  contract: MasterChef | null,
  address: string,
  onsenId: i32,
  currentBlockNumber: BigInt,
): BigInt {
  if (!contract) {
    log.info("Contract for address {} does not exist at block {}", [
      address,
      currentBlockNumber.toString(),
    ]);
    return BigInt.fromString("0");
  }

  return contract.userInfo(BigInt.fromI32(onsenId), Address.fromString(address)).value0;
}

/**
 * Determines the value of a given balance.
 *
 * @param balance Balance of a token
 * @param decimals Number of decimals
 * @param rate The conversion rate
 * @returns BigDecimal representing the value
 */
export function getValue(balance: BigInt, decimals: number, rate: BigDecimal): BigDecimal {
  return toDecimal(balance, decimals).times(rate);
}

/**
 * Fetches the balance of the given ERC20 token from the
 * specified wallet.
 *
 * @param tokenName The name of the token
 * @param walletAddress The wallet address to determine the balance from
 * @param contract ERC20 contract
 * @param rate the unit price/rate of the token
 * @param blockNumber the current block number
 * @returns TokenRecord object or null
 */
export function getERC20TokenRecordFromWallet(
  tokenName: string,
  walletAddress: string,
  contract: ERC20 | null,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  const balance = toDecimal(
    getERC20Balance(contract, walletAddress, blockNumber),
    contract ? contract.decimals() : 18,
  );
  if (!balance || balance.equals(BigDecimal.zero())) return null;

  return newTokenRecord(
    tokenName,
    contract ? contract._address.toHexString() : "N/A",
    getContractName(walletAddress),
    walletAddress,
    rate,
    balance,
    blockNumber,
  );
}

/**
 * Fetches the balances of the given ERC20 token from
 * the wallets defined in {WALLET_ADDRESSES}.
 *
 * @param tokenName The name of the token
 * @param contract ERC20 contract
 * @param rate the unit price/rate of the token
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getERC20TokenRecordsFromWallets(
  tokenName: string,
  contract: ERC20 | null,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(tokenName, blockNumber);

  for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
    const record = getERC20TokenRecordFromWallet(
      tokenName,
      WALLET_ADDRESSES[i],
      contract,
      rate,
      blockNumber,
    );
    if (!record) continue;

    pushTokenRecord(records, record);
  }

  return records;
}

/**
 * Returns the balance for a given contract in the Rari Allocator.
 *
 * If the contract does not have an entry in the Rari Allocator,
 * null is returned.
 *
 * @param contractAddress the contract to look up
 * @param blockNumber the current block number
 * @returns BigDecimal or null
 */
function getRariAllocatorBalance(contractAddress: string, blockNumber: BigInt): BigDecimal | null {
  const rariAllocatorId = getRariAllocatorId(contractAddress);
  const rariAllocator = getRariAllocator(RARI_ALLOCATOR, blockNumber);
  const contract = getERC20(getContractName(contractAddress), contractAddress, blockNumber);

  if (rariAllocatorId === ALLOCATOR_RARI_ID_NOT_FOUND || !rariAllocator || !contract) {
    return null;
  }

  return toDecimal(
    rariAllocator.amountAllocated(BigInt.fromI32(rariAllocatorId)),
    contract.decimals(),
  );
}

/**
 * Returns the balance of {contractAddress} in the Rari Allocator.
 *
 * @param tokenAddress ERC20 contract to find the balance of
 * @param price
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getRariAllocatorRecords(
  tokenAddress: string,
  price: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords("Rari Allocator", blockNumber);

  const balance = getRariAllocatorBalance(tokenAddress, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  pushTokenRecord(
    records,
    newTokenRecord(
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(RARI_ALLOCATOR),
      RARI_ALLOCATOR,
      price,
      balance,
      blockNumber,
    ),
  );

  return records;
}

/**
 * Returns the balance of {contractAddress} in the Onsen Allocator.
 *
 * @param tokenAddress ERC20 contract to find the balance of
 * @param price
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getOnsenAllocatorRecords(
  tokenAddress: string,
  price: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords("Onsen Allocator", blockNumber);

  const balance = getOnsenBalance(tokenAddress, ONSEN_ALLOCATOR, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  pushTokenRecord(
    records,
    newTokenRecord(
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(ONSEN_ALLOCATOR),
      ONSEN_ALLOCATOR,
      price,
      balance,
      blockNumber,
    ),
  );

  return records;
}

/**
 * Gets the balance of the given token in the Convex Allocator.
 *
 * FRAX is the only supported token.
 *
 * @param tokenAddress the token to look for
 * @param allocatorAddress the allocator to use
 * @param blockNumber the current block
 * @returns BigDecimal or null
 */
function getFraxConvexAllocatorBalance(
  tokenAddress: string,
  allocatorAddress: string,
  blockNumber: BigInt,
): BigDecimal | null {
  // FRAX only
  if (tokenAddress !== ERC20_FRAX) return null;

  // Allocator must exist
  const allocator = getConvexAllocator(allocatorAddress, blockNumber);
  if (!allocator) return null;

  return toDecimal(allocator.totalValueDeployed().times(BigInt.fromString("1000000000")), 18);
}

/**
 * Returns records for the given token in the Convex Allocator.
 *
 * @param tokenAddress the token to look for
 * @param blockNumber the current block
 * @returns TokenRecords object
 */
export function getFraxConvexAllocatorRecords(
  tokenAddress: string,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords("Frax Convex Allocator", blockNumber);

  for (let i = 0; i < ALLOCATOR_CONVEX_FRAX_CONTRACTS.length; i++) {
    const allocatorAddress = ALLOCATOR_CONVEX_FRAX_CONTRACTS[i];
    const balance = getFraxConvexAllocatorBalance(tokenAddress, allocatorAddress, blockNumber);
    if (!balance || balance.equals(BigDecimal.zero())) continue;

    pushTokenRecord(
      records,
      newTokenRecord(
        getContractName(tokenAddress),
        tokenAddress,
        getContractName(allocatorAddress),
        allocatorAddress,
        BigDecimal.fromString("1"),
        balance,
        blockNumber,
      ),
    );
  }

  return records;
}

export function getConvexStakedBalance(
  tokenAddress: string,
  allocatorAddress: string,
  stakingAddress: string,
  blockNumber: BigInt,
): BigDecimal | null {
  // Unsupported
  if (tokenAddress == NATIVE_ETH) return null;

  // Check if tokenAddress is the same as that on the staking contract
  const stakingContract = ConvexBaseRewardPool.bind(Address.fromString(stakingAddress));
  if (!stakingContract.stakingToken().equals(Address.fromString(tokenAddress))) return null;

  const tokenContract = getERC20(getContractName(tokenAddress), tokenAddress, blockNumber);
  if (!tokenContract) {
    throw new Error("Unable to bind with ERC20 contract " + tokenAddress);
  }

  // Get balance
  const balance = stakingContract.balanceOf(Address.fromString(allocatorAddress));
  return toDecimal(balance, tokenContract.decimals());
}

/**
 * Returns the details of the specified token staked in Convex
 * from the Convex allocator contracts.
 *
 * @param tokenAddress
 * @param blockNumber
 */
export function getConvexStakedRecords(tokenAddress: string, blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords(
    "Staked Convex Allocator-" + getContractName(tokenAddress),
    blockNumber,
  );

  // Loop through allocators
  for (let i = 0; i < ALLOCATOR_CONVEX_FRAX_CONTRACTS.length; i++) {
    const allocatorAddress = ALLOCATOR_CONVEX_FRAX_CONTRACTS[i];

    // Look through staking contracts
    for (let j = 0; j < CONVEX_STAKING_CONTRACTS.length; j++) {
      const stakingAddress = CONVEX_STAKING_CONTRACTS[j];

      const balance = getConvexStakedBalance(
        tokenAddress,
        allocatorAddress,
        stakingAddress,
        blockNumber,
      );
      if (!balance) continue;

      pushTokenRecord(
        records,
        newTokenRecord(
          getContractName(tokenAddress),
          tokenAddress,
          getContractName(allocatorAddress),
          allocatorAddress,
          getUSDRate(tokenAddress, blockNumber),
          balance,
          blockNumber,
        ),
      );
    }
  }

  return records;
}

/**
 * Returns the balance (deposits) from the LUSD allocator ({allocatorAddress})
 * into the specified Liquity stability pool ({poolAddress}).
 *
 * @param allocatorAddress allocator address
 * @param poolAddress stability pool address
 * @param blockNumber the current block number
 * @returns BigDecimal or null
 */
function getLiquityStabilityPoolBalance(
  allocatorAddress: string,
  poolAddress: string,
  blockNumber: BigInt,
): BigDecimal | null {
  const pool = getStabilityPool(poolAddress, blockNumber);
  if (!pool) return null;

  return toDecimal(pool.deposits(Address.fromString(allocatorAddress)).value0, 18);
}

/**
 * Returns the balance of {tokenAddress} in the Liquity stability pools.
 *
 * @param tokenAddress
 * @param blockNumber
 * @returns
 */
export function getLiquityStabilityPoolRecords(
  tokenAddress: string,
  blockNumber: BigInt,
): TokenRecords {
  // TODO assumes a USD rate of $1
  const records = newTokenRecords("Liquity Stability Pool", blockNumber);

  const liquityAllocator = getLiquityAllocator(tokenAddress);
  if (!liquityAllocator) return records;

  for (let i = 0; i < ALLOCATOR_LIQUITY_STABILITY_POOLS.length; i++) {
    const poolAddress = ALLOCATOR_LIQUITY_STABILITY_POOLS[i];
    const balance = getLiquityStabilityPoolBalance(liquityAllocator!, poolAddress, blockNumber);
    if (!balance || balance.equals(BigDecimal.zero())) continue;

    pushTokenRecord(
      records,
      newTokenRecord(
        getContractName(tokenAddress),
        tokenAddress,
        getContractName(poolAddress),
        poolAddress,
        BigDecimal.fromString("1"),
        balance,
        blockNumber,
      ),
    );
  }

  return records;
}

/**
 * Returns the balance of {tokenAddress} in the given
 * VeFXS allocator {allocatorAddress}.
 *
 * Only VeFXS {ERC20_FXS_VE} is supported.
 *
 * @param tokenAddress token address to look up
 * @param allocatorAddress allocator address
 * @param blockNumber the current block
 * @returns BigDecimal or null
 */
function getVeFXSAllocatorBalance(
  tokenAddress: string,
  allocatorAddress: string,
  blockNumber: BigInt,
): BigDecimal | null {
  // Only VeFXS supported
  if (tokenAddress !== ERC20_FXS_VE) return null;

  const contract = getVeFXS(tokenAddress, blockNumber);
  if (!contract) return null;

  return toDecimal(contract.locked(Address.fromString(allocatorAddress)).value0, 18);
}

export function getVeFXSAllocatorRecords(tokenAddress: string, blockNumber: BigInt): TokenRecords {
  const records = newTokenRecords("VeFXS Allocator", blockNumber);

  const balance = getVeFXSAllocatorBalance(tokenAddress, VEFXS_ALLOCATOR, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  const fxsRate = getUSDRate(ERC20_FXS, blockNumber);

  pushTokenRecord(
    records,
    newTokenRecord(
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(VEFXS_ALLOCATOR),
      VEFXS_ALLOCATOR,
      fxsRate,
      balance,
      blockNumber,
    ),
  );

  return records;
}
