import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { BalancerLiquidityGauge } from "../../generated/ProtocolMetrics/BalancerLiquidityGauge";
import { ConvexAllocator } from "../../generated/ProtocolMetrics/ConvexAllocator";
import { ConvexBaseRewardPool } from "../../generated/ProtocolMetrics/ConvexBaseRewardPool";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { LQTYStaking } from "../../generated/ProtocolMetrics/LQTYStaking";
import { LUSDAllocatorV2 } from "../../generated/ProtocolMetrics/LUSDAllocatorV2";
import { MasterChef } from "../../generated/ProtocolMetrics/MasterChef";
import { RariAllocator } from "../../generated/ProtocolMetrics/RariAllocator";
import { sOlympusERC20 } from "../../generated/ProtocolMetrics/sOlympusERC20";
import { sOlympusERC20V2 } from "../../generated/ProtocolMetrics/sOlympusERC20V2";
import { sOlympusERC20V3 } from "../../generated/ProtocolMetrics/sOlympusERC20V3";
import { TokeAllocator } from "../../generated/ProtocolMetrics/TokeAllocator";
import { TokemakStaking } from "../../generated/ProtocolMetrics/TokemakStaking";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import { VeFXS } from "../../generated/ProtocolMetrics/VeFXS";
import { TokenRecord, TokenRecords } from "../../generated/schema";
import {
  ALLOCATOR_ONSEN_ID_NOT_FOUND,
  ALLOCATOR_RARI_ID_NOT_FOUND,
  BALANCER_LIQUIDITY_GAUGES,
  CONTRACT_STARTING_BLOCK_MAP,
  CONVEX_ALLOCATORS,
  CONVEX_STAKING_CONTRACTS,
  ERC20_CVX,
  ERC20_FXS,
  ERC20_FXS_VE,
  ERC20_LQTY,
  ERC20_LUSD,
  ERC20_WETH,
  getContractName,
  getOnsenAllocatorId,
  getRariAllocatorId,
  getWalletAddressesForContract,
  liquidityPairHasToken,
  LQTY_STAKING,
  LUSD_ALLOCATOR,
  NATIVE_ETH,
  ONSEN_ALLOCATOR,
  RARI_ALLOCATOR,
  SUSHI_MASTERCHEF,
  TOKE_ALLOCATOR,
  TOKE_STAKING,
  VEFXS_ALLOCATOR,
} from "./Constants";
import { toDecimal } from "./Decimals";
import { getUSDRate } from "./Price";
import {
  addToMetricName,
  combineTokenRecords,
  newTokenRecord,
  newTokenRecords,
  pushTokenRecord,
} from "./TokenRecordHelper";

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
const contractsTokeAllocator = new Map<string, TokeAllocator>();
const contractsMasterChef = new Map<string, MasterChef>();
const contractsVeFXS = new Map<string, VeFXS>();
const contractsConvexAllocator = new Map<string, ConvexAllocator>();
const contractsLUSDAllocator = new Map<string, LUSDAllocatorV2>();

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
  log.debug("contractExistsAtBlock: Checking for starting block of contract {} ({}) at block {}", [
    getContractName(contractAddress),
    contractAddress,
    blockNumber.toString(),
  ]);

  // Assuming the starting block is much earlier
  if (!CONTRACT_STARTING_BLOCK_MAP.has(contractAddress)) {
    log.debug(
      "contractExistsAtBlock: No starting block defined for contract {} ({}). Assuming it is prior to the current block {}",
      [getContractName(contractAddress), contractAddress, blockNumber.toString()],
    );
    return true;
  }

  const startingBlock: string = CONTRACT_STARTING_BLOCK_MAP.get(contractAddress) || "N/A";
  log.debug("contractExistsAtBlock: Starting block for contract {} ({}): {}", [
    getContractName(contractAddress),
    contractAddress,
    startingBlock,
  ]);

  // Current block is before the starting block
  if (blockNumber < BigInt.fromString(startingBlock)) {
    log.debug(
      "contractExistsAtBlock: Current block {} is before the starting block for contract {} ({}). Skipping",
      [blockNumber.toString(), getContractName(contractAddress), contractAddress],
    );
    return false;
  }

  return true;
}

/**
 * Binds with an ERC20 contract located at {contractAddress}.
 *
 * If the contract does not exist at the current block number, null will be returned.
 *
 * @param contractName Name of the contract
 * @param contractAddress Address of the contract
 * @param currentBlockNumber block number
 * @returns ERC20 or null
 */
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

/**
 * Determines the number of decimals of a given ERC20 contract by
 * calling the `decimals()` function on the contract.
 *
 * An error will be thrown if the contract is inaccessible.
 *
 * @param contractAddress contract address
 * @param blockNumber current block number
 * @returns number representing the decimals
 */
export function getERC20Decimals(contractAddress: string, blockNumber: BigInt): number {
  const contractName = getContractName(contractAddress);
  const contract = getERC20(contractName, contractAddress, blockNumber);
  if (!contract) {
    throw new Error(
      "getERC20Decimals: unable to find ERC20 contract for " +
        contractName +
        "(" +
        contractAddress +
        ") at block " +
        blockNumber.toString(),
    );
  }

  /**
   * If this isn't implemented, there will be the following error at block 14712001:
   *
   * `overflow converting 0x046d6477f18d26592340 to i32`
   */
  if (Address.fromString(contractAddress).equals(Address.fromString(ERC20_CVX))) {
    log.info(
      "getERC20Decimals: returning hard-coded decimals of 18 for the {} ({}) contract, due to an overflow error",
      [contractName, contractAddress],
    );
    return 18;
  }

  return contract.decimals();
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

/**
 * Binds with a UniswapV2Pair contract.
 *
 * If the contract cannot be bound, or it does not exist at the current block number,
 * null will be returned.
 *
 * @param contractAddress contract address
 * @param currentBlockNumber the current block number
 * @returns UniswapV2Pair or null
 */
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

/**
 * Binds with a UniswapV3Pair contract.
 *
 * If the contract cannot be bound, or it does not exist at the current block number,
 * null will be returned.
 *
 * @param contractAddress contract address
 * @param currentBlockNumber the current block number
 * @returns UniswapV3Pair or null
 */
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

export function getTokeAllocator(
  contractAddress: string,
  currentBlockNumber: BigInt,
): TokeAllocator | null {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsTokeAllocator.has(contractAddress)) {
    log.debug("Binding TokeAllocator contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = TokeAllocator.bind(Address.fromString(contractAddress));
    contractsTokeAllocator.set(contractAddress, contract);
  }

  return contractsTokeAllocator.get(contractAddress);
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

/**
 * Helper method to simplify getting the balance from an ERC20 contract.
 *
 * Returns 0 if the minimum block number has not passed.
 *
 * @param contract The bound ERC20 contract.
 * @param address The address of the holder.
 * @param currentBlockNumber The current block number.
 * @returns BigInt
 */
export function getERC20Balance(
  contract: ERC20 | null,
  address: string,
  currentBlockNumber: BigInt,
): BigInt {
  if (!contract) {
    log.debug("Contract for address {} ({}) does not exist at block {}", [
      getContractName(address),
      address,
      currentBlockNumber.toString(),
    ]);
    return BigInt.fromString("0");
  }

  const balance = contract.balanceOf(Address.fromString(address));
  log.debug(
    "getERC20Balance: Found balance {} in ERC20 contract {} ({}) for wallet {} ({}) at block number {}",
    [
      balance.toString(),
      getContractName(contract._address.toHexString()),
      contract._address.toHexString(),
      getContractName(address),
      address,
      currentBlockNumber.toString(),
    ],
  );
  return balance;
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
    log.debug("getUniswapV2PairBalance: Contract for address {} does not exist at block {}", [
      address,
      currentBlockNumber.toString(),
    ]);
    return BigInt.fromString("0");
  }

  if (tokenAddress && !liquidityPairHasToken(contract._address.toHexString(), tokenAddress)) {
    return BigInt.fromString("0");
  }

  log.debug(
    "getUniswapV2PairBalance: Getting UniswapV2Pair balance in contract {} for wallet {} at block number {}",
    [contract._address.toHexString(), address, currentBlockNumber.toString()],
  );

  return contract.balanceOf(Address.fromString(address));
}

/**
 * Helper method to simplify getting the balance from a MasterChef/Onsen contract.
 *
 * Returns 0 if the minimum block number has not passed or there is no matching Onsen ID.
 *
 * @param tokenAddress The bound MasterChef/Onsen contract.
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
    log.debug("Contract for address {} does not exist at block {}", [
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
    log.debug("Contract for address {} does not exist at block {}", [
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
 * @param metricName The name of the current metric, which is used for entity ids
 * @param contractAddress ERC20 contract address
 * @param walletAddress The wallet address to determine the balance from
 * @param contract ERC20 contract
 * @param rate the unit price/rate of the token
 * @param blockNumber the current block number
 * @returns TokenRecord object or null
 */
export function getERC20TokenRecordFromWallet(
  metricName: string,
  contractAddress: string,
  walletAddress: string,
  contract: ERC20,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  const callResult = contract.try_balanceOf(Address.fromString(walletAddress));
  if (callResult.reverted) {
    log.warning("Contract {} reverted while trying to obtain balance at block {}", [
      getContractName(contract._address.toHexString()),
      blockNumber.toString(),
    ]);
    return null;
  }

  const decimals = getERC20Decimals(contractAddress, blockNumber);

  const balance = toDecimal(getERC20Balance(contract, walletAddress, blockNumber), decimals);
  if (!balance || balance.equals(BigDecimal.zero())) return null;

  return newTokenRecord(
    metricName,
    getContractName(contractAddress),
    contractAddress,
    getContractName(walletAddress),
    walletAddress,
    rate,
    balance,
    blockNumber,
  );
}

/**
 * Fetches the balances of the given ERC20 token from
 * the wallets defined in {getWalletAddressesForContract}.
 *
 * @param metricName The name of the current metric, which is used for entity ids
 * @param contractAddress ERC20 contract address
 * @param contract ERC20 contract
 * @param rate the unit price/rate of the token
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getERC20TokenRecordsFromWallets(
  metricName: string,
  contractAddress: string,
  contract: ERC20,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(
    addToMetricName(metricName, getContractName(contractAddress)),
    blockNumber,
  );
  const wallets = getWalletAddressesForContract(contractAddress);

  for (let i = 0; i < wallets.length; i++) {
    const record = getERC20TokenRecordFromWallet(
      metricName,
      contractAddress,
      wallets[i],
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
 * Returns the staked balance of {tokenContract} belonging to {walletAddress}
 * in the Tokemak staking contract.
 *
 * @param stakingContract
 * @param tokenContract
 * @param walletAddress
 * @param blockNumber
 * @returns
 */
function getTokeStakedBalance(
  stakingContract: TokemakStaking,
  tokenContract: ERC20,
  walletAddress: string,
  _blockNumber: BigInt,
): BigDecimal {
  return toDecimal(
    stakingContract.balanceOf(Address.fromString(walletAddress)),
    tokenContract.decimals(),
  );
}

/**
 * Returns records for the staked balance of {tokenAddress} across
 * all wallets that are staked with Tokemak.
 *
 * @param metricName
 * @param tokenAddress
 * @param rate
 * @param blockNumber
 * @returns
 */
export function getTokeStakedBalancesFromWallets(
  metricName: string,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(
    addToMetricName(metricName, getContractName(tokenAddress)),
    blockNumber,
  );

  // Check that the token matches
  const contract = TokemakStaking.bind(Address.fromString(TOKE_STAKING));
  if (contract.try_tokeToken().reverted) {
    log.warning(
      "getTokeStakedBalancesFromWallets: TOKE staking contract reverted at block {}. Skipping",
      [blockNumber.toString()],
    );
    return records;
  }

  // Ignore if we're looping through and the staking token doesn't match
  if (!contract.tokeToken().equals(Address.fromString(tokenAddress))) {
    return records;
  }

  // Check that the token exists
  const tokenContract = getERC20(getContractName(tokenAddress), tokenAddress, blockNumber);
  if (tokenContract == null) {
    return records;
  }

  // Iterate over all relevant wallets
  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balance = getTokeStakedBalance(contract, tokenContract, currentWallet, blockNumber);
    if (balance.equals(BigDecimal.zero())) {
      continue;
    }

    log.debug(
      "getTokeStakedBalancesFromWallets: found staked balance {} for token {} ({}) and wallet {} ({}) at block {}",
      [
        balance.toString(),
        getContractName(tokenAddress),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        blockNumber.toString(),
      ],
    );

    pushTokenRecord(
      records,
      newTokenRecord(
        metricName,
        getContractName(tokenAddress),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
      ),
    );
  }

  return records;
}

/**
 * Returns the staked balance of {tokenContract} belonging to {walletAddress}
 * in the Liquity staking contract.
 *
 * @param stakingContract
 * @param tokenContract
 * @param walletAddress
 * @param blockNumber
 * @returns
 */
function getLiquityStakedBalance(
  stakingContract: LQTYStaking,
  tokenContract: ERC20,
  walletAddress: string,
  _blockNumber: BigInt,
): BigDecimal {
  return toDecimal(
    stakingContract.stakes(Address.fromString(walletAddress)),
    tokenContract.decimals(),
  );
}

/**
 * Returns records for the staked balance of {tokenAddress} across
 * all wallets that are staked with Liquity.
 *
 * @param metricName
 * @param tokenAddress
 * @param rate
 * @param blockNumber
 * @returns
 */
export function getLiquityStakedBalancesFromWallets(
  metricName: string,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(
    addToMetricName(metricName, getContractName(tokenAddress)),
    blockNumber,
  );

  // Check that the token matches
  const contract = LQTYStaking.bind(Address.fromString(LQTY_STAKING));
  if (contract.try_lqtyToken().reverted) {
    log.warning(
      "getLiquityStakedBalancesFromWallets: LQTY staking contract reverted at block {}. Skipping",
      [blockNumber.toString()],
    );
    return records;
  }

  // Ignore if we're looping through and the staking token doesn't match
  if (!contract.lqtyToken().equals(Address.fromString(tokenAddress))) {
    return records;
  }

  // Check that the token exists
  const tokenContract = getERC20(getContractName(tokenAddress), tokenAddress, blockNumber);
  if (tokenContract == null) {
    return records;
  }

  // Iterate over all relevant wallets
  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balance = getLiquityStakedBalance(contract, tokenContract, currentWallet, blockNumber);
    if (balance.equals(BigDecimal.zero())) {
      continue;
    }

    log.debug(
      "getLiquityStakedBalancesFromWallets: found staked balance {} for token {} ({}) and wallet {} ({}) at block {}",
      [
        balance.toString(),
        getContractName(tokenAddress),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        blockNumber.toString(),
      ],
    );

    pushTokenRecord(
      records,
      newTokenRecord(
        metricName,
        getContractName(tokenAddress),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
      ),
    );
  }

  return records;
}

/**
 * Returns the gauge balance of {tokenContract} belonging to {walletAddress}
 * in a Balancer liquidity gauge.
 *
 * @param gaugeContract
 * @param tokenContract
 * @param walletAddress
 * @param blockNumber
 * @returns
 */
function getBalancerGaugeBalance(
  gaugeContract: BalancerLiquidityGauge,
  tokenContract: ERC20,
  walletAddress: string,
  _blockNumber: BigInt,
): BigDecimal {
  return toDecimal(
    gaugeContract.balanceOf(Address.fromString(walletAddress)),
    tokenContract.decimals(),
  );
}

/**
 * Returns records for the gauge balance of {tokenAddress} across
 * all wallets that are deposited in the given Balancer liquidity gauge.
 *
 * @param metricName
 * @param gaugeContractAddress
 * @param tokenAddress
 * @param rate
 * @param blockNumber
 * @returns
 */
export function getBalancerGaugeBalanceFromWallets(
  metricName: string,
  gaugeContractAddress: string,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(
    addToMetricName(metricName, getContractName(tokenAddress)),
    blockNumber,
  );

  log.debug(
    "getBalancerGaugeBalanceFromWallets: determining wallet balances in liquidity gauge {} ({}) of token {} ({}) at block {}",
    [
      getContractName(gaugeContractAddress),
      gaugeContractAddress,
      getContractName(tokenAddress),
      tokenAddress,
      blockNumber.toString(),
    ],
  );

  // Check that the token matches
  const contract = BalancerLiquidityGauge.bind(Address.fromString(gaugeContractAddress));
  if (contract.try_lp_token().reverted) {
    log.warning(
      "getBalancerGaugeBalanceFromWallets: Balancer liquidity gauge contract reverted at block {}. Skipping",
      [blockNumber.toString()],
    );
    return records;
  }

  // Ignore if we're looping through and the LP token doesn't match
  if (!contract.lp_token().equals(Address.fromString(tokenAddress))) {
    log.debug(
      "getBalancerGaugeBalanceFromWallets: output of lp_token() did not match current token {} ({}) at block {}. Skipping",
      [getContractName(tokenAddress), tokenAddress, blockNumber.toString()],
    );
    return records;
  }

  // Check that the token exists
  const tokenContract = getERC20(getContractName(tokenAddress), tokenAddress, blockNumber);
  if (tokenContract == null) {
    log.debug(
      "getBalancerGaugeBalanceFromWallets: token {} ({}) does not seem to exist at block {}. Skipping",
      [getContractName(tokenAddress), tokenAddress, blockNumber.toString()],
    );
    return records;
  }

  // Iterate over all relevant wallets
  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balance = getBalancerGaugeBalance(contract, tokenContract, currentWallet, blockNumber);
    if (balance.equals(BigDecimal.zero())) {
      continue;
    }

    log.debug(
      "getBalancerGaugeBalanceFromWallets: found balance {} for token {} ({}) and wallet {} ({}) at block {}",
      [
        balance.toString(),
        getContractName(tokenAddress),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        blockNumber.toString(),
      ],
    );

    pushTokenRecord(
      records,
      newTokenRecord(
        metricName,
        getContractName(tokenAddress),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
      ),
    );
  }

  return records;
}

/**
 * Iterates through all Balancer Liquidity Gauges and returns the
 * balances.
 *
 * @param metricName
 * @param tokenAddress
 * @param rate
 * @param blockNumber
 * @returns
 */
export function getBalancerGaugeBalancesFromWallets(
  metricName: string,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(
    addToMetricName(metricName, getContractName(tokenAddress)),
    blockNumber,
  );

  for (let i = 0; i < BALANCER_LIQUIDITY_GAUGES.length; i++) {
    combineTokenRecords(
      records,
      getBalancerGaugeBalanceFromWallets(
        metricName,
        BALANCER_LIQUIDITY_GAUGES[i],
        tokenAddress,
        rate,
        blockNumber,
      ),
    );
  }

  return records;
}

/**
 * Returns the balance for a given contract in the Toke Allocator.
 *
 * If the contract does not have an entry in the Toke Allocator,
 * null is returned.
 *
 * @param contractAddress the contract to look up
 * @param blockNumber the current block number
 * @returns BigDecimal or null
 */
function getTokeAllocatorBalance(contractAddress: string, blockNumber: BigInt): BigDecimal | null {
  const allocatorId = getRariAllocatorId(contractAddress);
  const tokeAllocator = getTokeAllocator(TOKE_ALLOCATOR, blockNumber);
  const contract = getERC20(getContractName(contractAddress), contractAddress, blockNumber);

  // No matching allocator id
  if (allocatorId === ALLOCATOR_RARI_ID_NOT_FOUND || !tokeAllocator || !contract) {
    return null;
  }

  if (tokeAllocator.try_ids().reverted) {
    log.warning("Toke Allocator contract reverted at block {}. Skipping", [blockNumber.toString()]);
    return null;
  }

  // Correct allocator for the id
  if (!tokeAllocator.ids().includes(BigInt.fromI32(allocatorId))) {
    return null;
  }

  return toDecimal(tokeAllocator.tokeDeposited(), contract.decimals());
}

/**
 * Returns the balance of {contractAddress} in the Toke Allocator.
 *
 * @param metricName The name of the current metric, which is used for entity ids
 * @param tokenAddress ERC20 contract to find the balance of
 * @param price
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getTokeAllocatorRecords(
  metricName: string,
  tokenAddress: string,
  price: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(addToMetricName(metricName, "TokeAllocator"), blockNumber);

  const balance = getTokeAllocatorBalance(tokenAddress, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  pushTokenRecord(
    records,
    newTokenRecord(
      metricName,
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(TOKE_ALLOCATOR),
      TOKE_ALLOCATOR,
      price,
      balance,
      blockNumber,
    ),
  );

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

  if (rariAllocator.try_ids().reverted) {
    log.warning("Rari Allocator contract reverted at block {}. Skipping", [blockNumber.toString()]);
    return null;
  }

  // Correct allocator for the id
  if (!rariAllocator.ids().includes(BigInt.fromI32(rariAllocatorId))) {
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
 * @param metricName The name of the current metric, which is used for entity ids
 * @param tokenAddress ERC20 contract to find the balance of
 * @param price
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getRariAllocatorRecords(
  metricName: string,
  tokenAddress: string,
  price: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(addToMetricName(metricName, "RariAllocator"), blockNumber);

  const balance = getRariAllocatorBalance(tokenAddress, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  pushTokenRecord(
    records,
    newTokenRecord(
      metricName,
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
 * @param metricName The name of the current metric, which is used for entity ids
 * @param tokenAddress ERC20 contract to find the balance of
 * @param price
 * @param blockNumber the current block number
 * @returns TokenRecords object
 */
export function getOnsenAllocatorRecords(
  metricName: string,
  tokenAddress: string,
  price: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(addToMetricName(metricName, "OnsenAllocator"), blockNumber);

  const balance = getOnsenBalance(tokenAddress, ONSEN_ALLOCATOR, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  pushTokenRecord(
    records,
    newTokenRecord(
      metricName,
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
 * Determines the balance of a Curve token
 * staked in Convex from the given allocator.
 *
 * @param tokenAddress
 * @param allocatorAddress
 * @param stakingAddress
 * @param blockNumber
 * @returns
 */
export function getConvexStakedBalance(
  tokenAddress: string,
  allocatorAddress: string,
  stakingAddress: string,
  blockNumber: BigInt,
): BigDecimal | null {
  // Unsupported
  if (tokenAddress == NATIVE_ETH) {
    log.info("getConvexStakedBalance: native ETH is unsupported", []);
    return null;
  }

  // Check if tokenAddress is the same as that on the staking contract
  const stakingContract = ConvexBaseRewardPool.bind(Address.fromString(stakingAddress));
  const stakingTokenResult = stakingContract.try_stakingToken();
  if (stakingTokenResult.reverted) {
    log.warning(
      "getConvexStakedBalance: Convex staking contract at {} likely doesn't exist at block {}",
      [stakingAddress, blockNumber.toString()],
    );
    return null;
  }

  // Ignore if we're looping through and the staking token doesn't match
  if (!stakingContract.stakingToken().equals(Address.fromString(tokenAddress))) {
    return null;
  }

  const tokenContract = getERC20(getContractName(tokenAddress), tokenAddress, blockNumber);
  if (!tokenContract) {
    throw new Error("getConvexStakedBalance: Unable to bind with ERC20 contract " + tokenAddress);
  }

  // Get balance
  const balance = stakingContract.balanceOf(Address.fromString(allocatorAddress));
  const decimalBalance = toDecimal(balance, tokenContract.decimals());
  log.debug(
    "getConvexStakedBalance: Balance of {} for staking token {} ({}) and allocator {} ({})",
    [
      decimalBalance.toString(),
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(allocatorAddress),
      allocatorAddress,
    ],
  );
  return decimalBalance;
}

/**
 * Returns the details of the specified token staked in Convex
 * from the Convex allocator contracts.
 *
 * Previously, the `totalValueDeployed` function on the Convex allocator contracts
 * was called to return a value, but no details of the tokens. The value was also
 * close, but not accurate.
 *
 * The implementation has shifted to instead check Convex staking contracts for a
 * staked balance from {CONVEX_ALLOCATORS}. The staking contract has a function
 * that returns the staked token, making this easier.
 *
 * @param metricName The name of the current metric, which is used for entity ids
 * @param tokenAddress the token address to look for
 * @param blockNumber the current block
 */
export function getConvexStakedRecords(
  metricName: string,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(
    addToMetricName(metricName, "StakedConvexAllocator-" + getContractName(tokenAddress)),
    blockNumber,
  );

  // Loop through allocators
  for (let i = 0; i < CONVEX_ALLOCATORS.length; i++) {
    const allocatorAddress = CONVEX_ALLOCATORS[i];

    // Look through staking contracts
    for (let j = 0; j < CONVEX_STAKING_CONTRACTS.length; j++) {
      const stakingAddress = CONVEX_STAKING_CONTRACTS[j];

      const balance = getConvexStakedBalance(
        tokenAddress,
        allocatorAddress,
        stakingAddress,
        blockNumber,
      );
      if (!balance || balance.equals(BigDecimal.zero())) continue;

      pushTokenRecord(
        records,
        newTokenRecord(
          metricName,
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

export function getLUSDAllocator(
  contractAddress: string,
  currentBlockNumber: BigInt,
): LUSDAllocatorV2 | null {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  if (!contractsLUSDAllocator.has(contractAddress)) {
    log.debug("Binding LiquityAllocator contract for address {}. Block number {}", [
      contractAddress,
      currentBlockNumber.toString(),
    ]);
    const contract = LUSDAllocatorV2.bind(Address.fromString(contractAddress));
    contractsLUSDAllocator.set(contractAddress, contract);
  }

  return contractsLUSDAllocator.get(contractAddress);
}

/**
 * Returns the balance of the given token in the Liquity stability pool
 * through the allocator at {allocatorAddress}
 *
 * @param allocatorAddress allocator address
 * @param tokenAddress token address
 * @param blockNumber the current block number
 * @returns BigDecimal or null
 */
export function getLiquityStabilityPoolBalance(
  allocatorAddress: string,
  tokenAddress: string,
  blockNumber: BigInt,
): BigDecimal | null {
  log.debug(
    "getLiquityStabilityPoolBalance: determining Liquity stability pool balance for allocator {} ({}) and token {} ({}) at block {}",
    [
      getContractName(allocatorAddress),
      allocatorAddress,
      getContractName(tokenAddress),
      tokenAddress,
      blockNumber.toString(),
    ],
  );
  const allocator = getLUSDAllocator(allocatorAddress, blockNumber);
  if (!allocator) {
    log.debug("getLiquityStabilityPoolBalance: no allocator. Skipping.", []);
    return null;
  }

  if (tokenAddress == ERC20_LUSD) {
    const lusdBalance = toDecimal(
      allocator.amountAllocated(BigInt.fromI32(getRariAllocatorId(ERC20_LUSD))),
    );
    log.info("getLiquityStabilityPoolBalance: found LUSD balance of {} at block {}", [
      lusdBalance.toString(),
      blockNumber.toString(),
    ]);
    return lusdBalance;
  }

  if (tokenAddress == ERC20_WETH) {
    const wethBalance = toDecimal(allocator.getETHRewards());
    log.info("getLiquityStabilityPoolBalance: found wETH balance of {} at block {}", [
      wethBalance.toString(),
      blockNumber.toString(),
    ]);
    return wethBalance;
  }

  if (tokenAddress == ERC20_LQTY) {
    const lqtyBalance = toDecimal(allocator.getLQTYRewards());
    log.info("getLiquityStabilityPoolBalance: found LQTY balance of {} at block {}", [
      lqtyBalance.toString(),
      blockNumber.toString(),
    ]);
    return lqtyBalance;
  }

  log.debug("getLiquityStabilityPoolBalance: no balance for unsupported token {} at block {}", [
    getContractName(tokenAddress),
    blockNumber.toString(),
  ]);
  return null;
}

/**
 * Returns the balance of {tokenAddress} in the Liquity stability pools.
 *
 * @param metricName The name of the current metric, which is used for entity ids
 * @param tokenAddress
 * @param rate
 * @param blockNumber
 * @returns
 */
export function getLiquityStabilityPoolRecords(
  metricName: string,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords(addToMetricName(metricName, "LiquityStabilityPool"), blockNumber);

  const balance = getLiquityStabilityPoolBalance(LUSD_ALLOCATOR, tokenAddress, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  log.info(
    "getLiquityStabilityPoolRecords: Found balance {} of token {} in Liquity allocator at block {}",
    [balance.toString(), getContractName(tokenAddress), blockNumber.toString()],
  );
  pushTokenRecord(
    records,
    newTokenRecord(
      metricName,
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(LUSD_ALLOCATOR),
      LUSD_ALLOCATOR,
      rate,
      balance,
      blockNumber,
    ),
  );

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

export function getVeFXSAllocatorRecords(
  metricName: string,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenRecords {
  const records = newTokenRecords("VeFXS Allocator", blockNumber);

  const balance = getVeFXSAllocatorBalance(tokenAddress, VEFXS_ALLOCATOR, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  const fxsRate = getUSDRate(ERC20_FXS, blockNumber);

  pushTokenRecord(
    records,
    newTokenRecord(
      metricName,
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
