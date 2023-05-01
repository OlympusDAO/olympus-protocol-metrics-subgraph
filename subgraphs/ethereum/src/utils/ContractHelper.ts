import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenRecord } from "../../../shared/generated/schema";
import { pushTokenRecordArray } from "../../../shared/src/utils/ArrayHelper";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import {
  createOrUpdateTokenRecord,
  getIsTokenLiquid,
  getTokenCategory,
} from "../../../shared/src/utils/TokenRecordHelper";
import { LUSD_ALLOCATOR, RARI_ALLOCATOR, VEFXS_ALLOCATOR } from "../../../shared/src/Wallets";
import { AuraLocker } from "../../generated/ProtocolMetrics/AuraLocker";
import { AuraStaking } from "../../generated/ProtocolMetrics/AuraStaking";
import { AuraVirtualBalanceRewardPool } from "../../generated/ProtocolMetrics/AuraVirtualBalanceRewardPool";
import { BalancerLiquidityGauge } from "../../generated/ProtocolMetrics/BalancerLiquidityGauge";
import { ConvexBaseRewardPool } from "../../generated/ProtocolMetrics/ConvexBaseRewardPool";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { FraxFarm } from "../../generated/ProtocolMetrics/FraxFarm";
import { LQTYStaking } from "../../generated/ProtocolMetrics/LQTYStaking";
import { LUSDAllocatorV2 } from "../../generated/ProtocolMetrics/LUSDAllocatorV2";
import { MakerDSR } from "../../generated/ProtocolMetrics/MakerDSR";
import { MasterChef } from "../../generated/ProtocolMetrics/MasterChef";
import { RariAllocator } from "../../generated/ProtocolMetrics/RariAllocator";
import { rlBTRFLY } from "../../generated/ProtocolMetrics/rlBTRFLY";
import { sOlympusERC20 } from "../../generated/ProtocolMetrics/sOlympusERC20";
import { sOlympusERC20V2 } from "../../generated/ProtocolMetrics/sOlympusERC20V2";
import { sOlympusERC20V3 } from "../../generated/ProtocolMetrics/sOlympusERC20V3";
import { TokeAllocator } from "../../generated/ProtocolMetrics/TokeAllocator";
import { TokemakStaking } from "../../generated/ProtocolMetrics/TokemakStaking";
import { UniswapV2Pair } from "../../generated/ProtocolMetrics/UniswapV2Pair";
import { UniswapV3Pair } from "../../generated/ProtocolMetrics/UniswapV3Pair";
import { VeFXS } from "../../generated/ProtocolMetrics/VeFXS";
import { vlCVX } from "../../generated/ProtocolMetrics/vlCVX";
import { ERC20TokenSnapshot } from "../../generated/schema";
import { getOrCreateERC20TokenSnapshot } from "../contracts/ERC20";
import { getOrCreateAuraLockedPoolSnapshot, getOrCreateAuraRewardPoolSnapshot, getOrCreateAuraStakingPoolSnapshot, getOrCreateBalancerGaugeStakingPoolSnapshot, getOrCreateConvexStakingPoolSnapshot, getOrCreateFraxStakingPoolSnapshot, getOrCreateLiquityStakingPoolSnapshot, getOrCreateTokemakStakingPoolSnapshot } from "../contracts/StakingPoolSnapshot";
import {
  addressesEqual,
  ALLOCATOR_ONSEN_ID_NOT_FOUND,
  ALLOCATOR_RARI_ID_NOT_FOUND,
  AURA_REWARDS_CONTRACTS,
  AURA_STAKING_CONTRACTS,
  BALANCER_LIQUIDITY_GAUGES,
  BLOCKCHAIN,
  CONTRACT_STARTING_BLOCK_MAP,
  CONVEX_ALLOCATORS,
  CONVEX_STAKING_CONTRACTS,
  ERC20_AURA_VL,
  ERC20_BTRFLY_V2_RL,
  ERC20_CVX,
  ERC20_CVX_VL_V2,
  ERC20_DAI,
  ERC20_FXS,
  ERC20_FXS_VE,
  ERC20_LQTY,
  ERC20_LUSD,
  ERC20_TOKENS,
  ERC20_WETH,
  getAuraStakedToken,
  getContractName,
  getMysoDeployments,
  getOnsenAllocatorId,
  getRariAllocatorId,
  getVendorDeployments,
  getWalletAddressesForContract,
  liquidityPairHasToken,
  LQTY_STAKING,
  MAKER_DSR,
  NATIVE_ETH,
  ONSEN_ALLOCATOR,
  SUSHI_MASTERCHEF,
  TOKE_ALLOCATOR,
  TOKE_STAKING,
} from "./Constants";
import { getUSDRate } from "./Price";

/**
 * The Graph recommends only binding a contract once
 * AssemblyScript doesn't like union types, so we have
 * to statically-type these contract maps.
 */
const contractsERC20 = new Map<string, ERC20>();
const contractsSOlympusERC20 = new Map<string, sOlympusERC20>();
const contractsSOlympusERC20V2 = new Map<string, sOlympusERC20V2>();
const contractsSOlympusERC20V3 = new Map<string, sOlympusERC20V3>();
const contractsUniswapV3Pair = new Map<string, UniswapV3Pair>();
const contractsRariAllocator = new Map<string, RariAllocator>();
const contractsTokeAllocator = new Map<string, TokeAllocator>();
const contractsMasterChef = new Map<string, MasterChef>();
const contractsVeFXS = new Map<string, VeFXS>();
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
  // Assuming the starting block is much earlier
  if (!CONTRACT_STARTING_BLOCK_MAP.has(contractAddress)) {
    return true;
  }

  // Current block is before the starting block
  const startingBlock: string = CONTRACT_STARTING_BLOCK_MAP.get(contractAddress) || "N/A";
  if (blockNumber < BigInt.fromString(startingBlock)) {
    return false;
  }

  return true;
}

/**
 * Binds with an ERC20 contract located at {contractAddress}.
 *
 * If the contract does not exist at the current block number, null will be returned.
 *
 * @param contractAddress Address of the contract
 * @param currentBlockNumber block number
 * @returns ERC20 or null
 */
export function getERC20(contractAddress: string, currentBlockNumber: BigInt): ERC20 | null {
  if (!contractExistsAtBlock(contractAddress, currentBlockNumber)) return null;

  // We can't bind for native (non-ERC20) ETH
  if (addressesEqual(contractAddress, NATIVE_ETH)) return null;

  if (!contractsERC20.has(contractAddress)) {
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

  const snapshot = getOrCreateERC20TokenSnapshot(contractAddress, blockNumber);
  if (!snapshot || snapshot.decimals <= 0) {
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

  return snapshot.decimals;
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

function getMasterChef(
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

function getTokeAllocator(
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

function getRariAllocator(
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

function getVeFXS(contractAddress: string, currentBlockNumber: BigInt): VeFXS | null {
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

export function getERC20DecimalBalance(tokenAddress: string, walletAddress: string, blockNumber: BigInt): BigDecimal {
  const tokenSnapshot = getOrCreateERC20TokenSnapshot(tokenAddress, blockNumber);
  const tokenContract = getERC20(tokenAddress, blockNumber);
  if (tokenContract === null || tokenSnapshot.totalSupply === null) {
    return BigDecimal.zero();
  }

  const balanceResult = tokenContract.try_balanceOf(Address.fromString(walletAddress));
  if (balanceResult.reverted) {
    return BigDecimal.zero();
  }

  return toDecimal(balanceResult.value, tokenSnapshot.decimals);
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
  if (onsenId == ALLOCATOR_ONSEN_ID_NOT_FOUND) {
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
  timestamp: BigInt,
  contractAddress: string,
  walletAddress: string,
  contract: ERC20,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord | null {
  const callResult = contract.try_balanceOf(Address.fromString(walletAddress));
  if (callResult.reverted) {
    log.warning(
      "getERC20TokenRecordFromWallet: Contract {} reverted while trying to obtain balance at block {}",
      [getContractName(contract._address.toHexString()), blockNumber.toString()],
    );
    return null;
  }

  const decimals = getERC20Decimals(contractAddress, blockNumber);

  const balance = toDecimal(callResult.value, decimals);
  if (!balance || balance.equals(BigDecimal.zero())) return null;

  log.debug("getERC20TokenRecordFromWallet: Found balance {} of token {} in wallet {} at block {}", [
    balance.toString(),
    getContractName(contractAddress),
    getContractName(walletAddress),
    blockNumber.toString(),
  ]);
  return createOrUpdateTokenRecord(
    timestamp,
    getContractName(contractAddress),
    contractAddress,
    getContractName(walletAddress),
    walletAddress,
    rate,
    balance,
    blockNumber,
    getIsTokenLiquid(contractAddress, ERC20_TOKENS),
    ERC20_TOKENS,
    BLOCKCHAIN,
  );
}

/**
 * Generates TokenRecord objects for the given ERC20 token, representing deposits into a
 * Vendor Finance market.
 * 
 * @param timestamp 
 * @param contractAddress 
 * @param rate 
 * @param blockNumber 
 * @returns 
 */
export function getVendorFinanceRecords(
  timestamp: BigInt,
  contractAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  const deployments = getVendorDeployments(contractAddress);
  if (deployments.length == 0) {
    return records;
  }

  for (let i = 0; i < deployments.length; i++) {
    const currentDeployment = deployments[i];
    // Exclude if before deployment
    if (blockNumber.lt(currentDeployment.getBlockNumber())) {
      continue;
    }

    records.push(createOrUpdateTokenRecord(
      timestamp,
      getContractName(contractAddress),
      contractAddress,
      getContractName(currentDeployment.getAddress()),
      currentDeployment.getAddress(),
      rate,
      currentDeployment.getAmount(),
      blockNumber,
      getIsTokenLiquid(contractAddress, ERC20_TOKENS),
      ERC20_TOKENS,
      BLOCKCHAIN,
    ));
  }

  return records;
}

/**
 * Generates TokenRecord objects for the given ERC20 token, representing deposits into a
 * Myso Finance market.
 * 
 * @param timestamp 
 * @param contractAddress 
 * @param rate 
 * @param blockNumber 
 * @returns 
 */
export function getMysoFinanceRecords(
  timestamp: BigInt,
  contractAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  const deployments = getMysoDeployments(contractAddress);
  if (deployments.length == 0) {
    return records;
  }

  for (let i = 0; i < deployments.length; i++) {
    const currentDeployment = deployments[i];
    // Exclude if before deployment
    if (blockNumber.lt(currentDeployment.getBlockNumber())) {
      continue;
    }

    records.push(createOrUpdateTokenRecord(
      timestamp,
      getContractName(contractAddress),
      contractAddress,
      getContractName(currentDeployment.getAddress()),
      currentDeployment.getAddress(),
      rate,
      currentDeployment.getAmount(),
      blockNumber,
      getIsTokenLiquid(contractAddress, ERC20_TOKENS),
      ERC20_TOKENS,
      BLOCKCHAIN,
    ));
  }

  return records;
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
 * @returns TokenRecord array
 */
export function getERC20TokenRecordsFromWallets(
  timestamp: BigInt,
  contractAddress: string,
  contract: ERC20,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  const wallets = getWalletAddressesForContract(contractAddress);

  for (let i = 0; i < wallets.length; i++) {
    const record = getERC20TokenRecordFromWallet(
      timestamp,
      contractAddress,
      wallets[i],
      contract,
      rate,
      blockNumber,
    );
    if (!record) continue;

    records.push(record);
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
  tokenSnapshot: ERC20TokenSnapshot,
  walletAddress: string,
  _blockNumber: BigInt,
): BigDecimal {
  return toDecimal(
    stakingContract.balanceOf(Address.fromString(walletAddress)),
    tokenSnapshot.decimals,
  );
}

/**
 * Returns records for the staked balance of {tokenAddress} across
 * all wallets that are locked with Aura.
 *
 * @param metricName
 * @param tokenAddress
 * @param rate
 * @param blockNumber
 * @returns
 */
export function getAuraLockedBalancesFromWallets(
  timestamp: BigInt,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const FUNC = "getAuraLockedBalancesFromWallets";
  const records: TokenRecord[] = [];

  // Ignore if we're looping through and the staking token doesn't match
  const stakingSnapshot = getOrCreateAuraLockedPoolSnapshot(ERC20_AURA_VL, blockNumber);
  const stakingSnapshotToken = stakingSnapshot.stakingToken;
  if (stakingSnapshotToken === null || !addressesEqual(stakingSnapshotToken.toHexString(), tokenAddress)) {
    return records;
  }

  // Iterate over all relevant wallets
  const contract = AuraLocker.bind(Address.fromString(ERC20_AURA_VL));
  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balanceResult = contract.lockedBalances(Address.fromString(currentWallet));
    const balance = toDecimal(balanceResult.getTotal(), 18);
    if (balance.equals(BigDecimal.zero())) {
      continue;
    }

    log.debug(
      "{}: found staked balance {} for token {} ({}) and wallet {} ({}) at block {}",
      [
        FUNC,
        balance.toString(),
        getContractName(ERC20_AURA_VL),
        ERC20_AURA_VL,
        getContractName(currentWallet),
        currentWallet,
        blockNumber.toString(),
      ],
    );

    records.push(
      createOrUpdateTokenRecord(
        timestamp,
        getContractName(ERC20_AURA_VL),
        ERC20_AURA_VL,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
        getIsTokenLiquid(ERC20_AURA_VL, ERC20_TOKENS),
        ERC20_TOKENS,
        BLOCKCHAIN,
      ),
    );
  }

  return records;
}

/**
 * Returns records for the unlocked balance of {tokenAddress} across
 * all wallets that are staked with rlBTRFLY.
 *
 * @param metricName
 * @param tokenAddress
 * @param rate
 * @param blockNumber
 * @returns
 */
export function getBtrflyUnlockedBalancesFromWallets(
  timestamp: BigInt,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];
  if (tokenAddress.toLowerCase() != ERC20_BTRFLY_V2_RL.toLowerCase()) {
    return records;
  }

  // Check that the token exists
  const tokenSnapshot = getOrCreateERC20TokenSnapshot(tokenAddress, blockNumber);
  if (tokenSnapshot === null || tokenSnapshot.decimals <= 0) {
    return records;
  }

  // Iterate over all relevant wallets
  const contract = rlBTRFLY.bind(Address.fromString(tokenAddress));
  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];

    // rlBTRFLY.balanceOf() returns the balance in active locks, so we only need to return unlocked balances
    // Source: https://github.com/redacted-cartel/contracts-v2/blob/7ef760ae4f4287caa0abf698060096c5cfebd0cf/contracts/core/RLBTRFLY.sol#L109
    const lockedBalances = contract.lockedBalances(Address.fromString(currentWallet));
    const balance: BigDecimal = toDecimal(lockedBalances.getUnlockable(), tokenSnapshot.decimals);
    if (balance.equals(BigDecimal.zero())) {
      continue;
    }

    log.debug(
      "getBtrflyLockedBalancesFromWallets: found unlocked balance {} for token {} ({}) and wallet {} ({}) at block {}",
      [
        balance.toString(),
        getContractName(tokenAddress, "Unlocked"),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        blockNumber.toString(),
      ],
    );

    records.push(
      createOrUpdateTokenRecord(
        timestamp,
        getContractName(tokenAddress, "Unlocked"), // Needed to differentiate
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
        getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
        ERC20_TOKENS,
        BLOCKCHAIN,
      ),
    );
  }

  return records;
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
  timestamp: BigInt,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  // Ignore if we're looping through and the staking token doesn't match
  const stakingSnapshot = getOrCreateTokemakStakingPoolSnapshot(TOKE_STAKING, blockNumber);
  const stakingSnapshotToken = stakingSnapshot.stakingToken;
  if (stakingSnapshotToken === null || !addressesEqual(stakingSnapshotToken.toHexString(), tokenAddress)) {
    return records;
  }

  // Check that the token exists
  const tokenSnapshot = getOrCreateERC20TokenSnapshot(tokenAddress, blockNumber);
  if (tokenSnapshot === null || tokenSnapshot.totalSupply === null) {
    return records;
  }

  // Iterate over all relevant wallets
  const contract = TokemakStaking.bind(Address.fromString(TOKE_STAKING));
  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balance = getTokeStakedBalance(contract, tokenSnapshot, currentWallet, blockNumber);
    if (balance.equals(BigDecimal.zero())) {
      continue;
    }

    log.debug(
      "getTokeStakedBalancesFromWallets: found staked balance {} for token {} ({}) and wallet {} ({}) at block {}",
      [
        balance.toString(),
        getContractName(tokenAddress, "Staked"),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        blockNumber.toString(),
      ],
    );

    records.push(
      createOrUpdateTokenRecord(
        timestamp,
        getContractName(tokenAddress, "Staked"), // Needed to differentiate as there is no token for TOKE
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
        getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
        ERC20_TOKENS,
        BLOCKCHAIN,
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
  tokenSnapshot: ERC20TokenSnapshot,
  walletAddress: string,
  _blockNumber: BigInt,
): BigDecimal {
  return toDecimal(
    stakingContract.stakes(Address.fromString(walletAddress)),
    tokenSnapshot.decimals,
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
  timestamp: BigInt,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  // Ignore if we're looping through and the staking token doesn't match
  const stakingSnapshot = getOrCreateLiquityStakingPoolSnapshot(LQTY_STAKING, blockNumber);
  const stakingSnapshotToken = stakingSnapshot.stakingToken;
  if (stakingSnapshotToken === null || !addressesEqual(stakingSnapshotToken.toHexString(), tokenAddress)) {
    return records;
  }

  // Check that the token exists
  const tokenSnapshot = getOrCreateERC20TokenSnapshot(tokenAddress, blockNumber);
  if (tokenSnapshot == null || tokenSnapshot.totalSupply === null) {
    return records;
  }

  // Iterate over all relevant wallets
  const contract = LQTYStaking.bind(Address.fromString(LQTY_STAKING));
  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balance = getLiquityStakedBalance(contract, tokenSnapshot, currentWallet, blockNumber);
    if (balance.equals(BigDecimal.zero())) {
      continue;
    }

    log.debug(
      "getLiquityStakedBalancesFromWallets: found staked balance {} for token {} ({}) and wallet {} ({}) at block {}",
      [
        balance.toString(),
        getContractName(tokenAddress, "Staked"),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        blockNumber.toString(),
      ],
    );

    records.push(
      createOrUpdateTokenRecord(
        timestamp,
        getContractName(tokenAddress, "Staked"), // Needed to differentiate as there is no token for LQTY
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
        getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
        ERC20_TOKENS,
        BLOCKCHAIN,
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
  tokenSnapshot: ERC20TokenSnapshot,
  walletAddress: string,
  _blockNumber: BigInt,
): BigDecimal {
  return toDecimal(
    gaugeContract.balanceOf(Address.fromString(walletAddress)),
    tokenSnapshot.decimals,
  );
}

/**
 * Returns the staked balance of {tokenContract} belonging to {walletAddress}
 * in Aura.
 *
 * @param stakingContract
 * @param tokenContract
 * @param walletAddress
 * @param blockNumber
 * @returns
 */
function getAuraStakedBalance(
  stakingContract: AuraStaking,
  tokenSnapshot: ERC20TokenSnapshot,
  walletAddress: string,
  _blockNumber: BigInt,
): BigDecimal {
  return toDecimal(
    stakingContract.balanceOf(Address.fromString(walletAddress)),
    tokenSnapshot.decimals,
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
 * @param multiplier
 * @param blockNumber
 * @returns
 */
export function getBalancerGaugeBalanceFromWallets(
  timestamp: BigInt,
  gaugeContractAddress: string,
  tokenAddress: string,
  rate: BigDecimal,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

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

  // Ignore if we're looping through and the staking token doesn't match
  const stakingSnapshot = getOrCreateBalancerGaugeStakingPoolSnapshot(gaugeContractAddress, blockNumber);
  const stakingSnapshotToken = stakingSnapshot.stakingToken;
  if (stakingSnapshotToken === null || !addressesEqual(stakingSnapshotToken.toHexString(), tokenAddress)) {
    log.debug(
      "getBalancerGaugeBalanceFromWallets: token {} ({}) does not match the staking token {} for vault {} ({}). Skipping",
      [getContractName(tokenAddress), tokenAddress, stakingSnapshotToken === null ? "null" : stakingSnapshotToken.toHexString(), getContractName(gaugeContractAddress), gaugeContractAddress],
    );
    return records;
  }

  // Check that the token exists
  const tokenSnapshot = getOrCreateERC20TokenSnapshot(tokenAddress, blockNumber);
  if (tokenSnapshot == null || tokenSnapshot.totalSupply === null) {
    log.debug(
      "getBalancerGaugeBalanceFromWallets: token {} ({}) does not seem to exist at block {}. Skipping",
      [getContractName(tokenAddress), tokenAddress, blockNumber.toString()],
    );
    return records;
  }

  // Iterate over all relevant wallets
  const contract = BalancerLiquidityGauge.bind(Address.fromString(gaugeContractAddress));
  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balance = getBalancerGaugeBalance(contract, tokenSnapshot, currentWallet, blockNumber);
    if (balance.equals(BigDecimal.zero())) {
      log.debug(
        "getBalancerGaugeBalanceFromWallets: 0 balance for token {} ({}) and wallet {} ({}) at block {}",
        [
          getContractName(tokenAddress, "Gauge Deposit"),
          tokenAddress,
          getContractName(currentWallet),
          currentWallet,
          blockNumber.toString(),
        ],
      );
      continue;
    }

    log.info(
      "getBalancerGaugeBalanceFromWallets: found balance {} for token {} ({}) and wallet {} ({}) at block {}",
      [
        balance.toString(),
        getContractName(tokenAddress, "Gauge Deposit"),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        blockNumber.toString(),
      ],
    );

    records.push(
      createOrUpdateTokenRecord(
        timestamp,
        getContractName(tokenAddress, "Gauge Deposit"),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
        getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
        ERC20_TOKENS,
        BLOCKCHAIN,
        multiplier,
        getTokenCategory(tokenAddress, ERC20_TOKENS),
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
  timestamp: BigInt,
  tokenAddress: string,
  rate: BigDecimal,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  for (let i = 0; i < BALANCER_LIQUIDITY_GAUGES.length; i++) {
    pushTokenRecordArray(
      records,
      getBalancerGaugeBalanceFromWallets(
        timestamp,
        BALANCER_LIQUIDITY_GAUGES[i],
        tokenAddress,
        rate,
        multiplier,
        blockNumber,
      ),
    );
  }

  return records;
}

/**
 * Returns records for the balance of {tokenAddress} staked in the given Aura staking address across
 * all wallets.
 *
 * @param metricName
 * @param stakingAddress
 * @param tokenAddress
 * @param rate
 * @param multiplier
 * @param blockNumber
 * @returns
 */
export function getAuraStakedBalanceFromWallets(
  timestamp: BigInt,
  stakingAddress: string,
  tokenAddress: string,
  rate: BigDecimal,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  log.debug(
    "getAuraStakedBalanceFromWallets: determining wallet balances staked in {} ({}) of token {} ({}) at block {}",
    [
      getContractName(stakingAddress),
      stakingAddress,
      getContractName(tokenAddress),
      tokenAddress,
      blockNumber.toString(),
    ],
  );

  // Ignore if we're looping through and the staking token doesn't match
  const stakingSnapshot = getOrCreateAuraStakingPoolSnapshot(stakingAddress, blockNumber);
  const stakingSnapshotToken = stakingSnapshot.stakingToken;
  if (stakingSnapshotToken === null || !addressesEqual(stakingSnapshotToken.toHexString(), tokenAddress)) {
    log.debug(
      "getAuraStakedBalanceFromWallets: token {} ({}) does not match the staking token {} for vault {} ({}). Skipping",
      [getContractName(tokenAddress), tokenAddress, stakingSnapshotToken === null ? "null" : stakingSnapshotToken.toHexString(), getContractName(stakingAddress), stakingAddress],
    );
    return records;
  }

  // Check that the token exists
  const tokenSnapshot = getOrCreateERC20TokenSnapshot(tokenAddress, blockNumber);
  if (tokenSnapshot == null || tokenSnapshot.totalSupply === null) {
    log.debug(
      "getAuraStakedBalanceFromWallets: token {} ({}) does not seem to exist at block {}. Skipping",
      [getContractName(tokenAddress), tokenAddress, blockNumber.toString()],
    );
    return records;
  }

  // Iterate over all relevant wallets
  const contract = AuraStaking.bind(Address.fromString(stakingAddress));
  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balance = getAuraStakedBalance(contract, tokenSnapshot, currentWallet, blockNumber);
    if (balance.equals(BigDecimal.zero())) {
      log.debug(
        "getAuraStakedBalanceFromWallets: 0 balance for token {} ({}) and wallet {} ({}) at block {}",
        [
          getContractName(tokenAddress),
          tokenAddress,
          getContractName(currentWallet),
          currentWallet,
          blockNumber.toString(),
        ],
      );
      continue;
    }

    log.info(
      "getAuraStakedBalanceFromWallets: found balance {} for token {} ({}) and wallet {} ({}) at block {}",
      [
        balance.toString(),
        getContractName(tokenAddress, `Staked in ${getContractName(stakingAddress)}`),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        blockNumber.toString(),
      ],
    );

    records.push(
      createOrUpdateTokenRecord(
        timestamp,
        getContractName(tokenAddress, `Staked in ${getContractName(stakingAddress)}`),
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
        getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
        ERC20_TOKENS,
        BLOCKCHAIN,
        multiplier,
        getTokenCategory(tokenAddress, ERC20_TOKENS),
      ),
    );
  }

  return records;
}

export function getAuraPoolEarnedRecords(timestamp: BigInt, contractAddress: string, rate: BigDecimal, blockNumber: BigInt): TokenRecord[] {
  const records: TokenRecord[] = [];

  for (let h = 0; h < AURA_REWARDS_CONTRACTS.length; h++) {
    const poolAddress = AURA_REWARDS_CONTRACTS[h];
    log.debug("getAuraPoolEarnedRecords: looking for Aura earned rewards for token {} ({}) in pool {} ({})", [getContractName(contractAddress), contractAddress, getContractName(poolAddress), poolAddress]);

    // Ignore if we're looping through and the staking token doesn't match
    const stakingSnapshot = getOrCreateAuraRewardPoolSnapshot(poolAddress, blockNumber);
    const stakingSnapshotToken = stakingSnapshot.stakingToken;
    if (stakingSnapshotToken === null || !addressesEqual(stakingSnapshotToken.toHexString(), contractAddress)) {
      continue;
    }

    // Iterate over all relevant wallets
    const rewardPool = AuraVirtualBalanceRewardPool.bind(Address.fromString(poolAddress));
    const wallets = getWalletAddressesForContract(contractAddress);
    for (let i = 0; i < wallets.length; i++) {
      const currentWallet = wallets[i];

      const earnedBalance: BigDecimal = toDecimal(rewardPool.earned(Address.fromString(currentWallet)), 18);
      if (earnedBalance.equals(BigDecimal.zero())) {
        continue;
      }

      log.debug(
        "getAuraPoolEarnedRecords: found earned balance {} for token {} ({}) and wallet {} ({}) in rewards pool {} ({}) at block {}",
        [
          earnedBalance.toString(),
          getContractName(contractAddress, `Rewards from ${getContractName(poolAddress)}`),
          contractAddress,
          getContractName(currentWallet),
          currentWallet,
          getContractName(poolAddress),
          poolAddress,
          blockNumber.toString(),
        ],
      );

      records.push(
        createOrUpdateTokenRecord(
          timestamp,
          getContractName(contractAddress, `Rewards from ${getContractName(poolAddress)}`),
          contractAddress,
          getContractName(currentWallet),
          currentWallet,
          rate,
          earnedBalance,
          blockNumber,
          getIsTokenLiquid(contractAddress, ERC20_TOKENS),
          ERC20_TOKENS,
          BLOCKCHAIN,
        ),
      );
    }
  }

  return records;
}

/**
 * Iterates through all Aura staking contracts and returns the
 * balances.
 *
 * @param metricName
 * @param tokenAddress
 * @param rate
 * @param blockNumber
 * @returns
 */
export function getAuraStakedBalancesFromWallets(
  timestamp: BigInt,
  tokenAddress: string,
  rate: BigDecimal,
  multiplier: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const stakedTokenAddress = getAuraStakedToken(tokenAddress);
  if (stakedTokenAddress === null) {
    return records;
  }

  for (let i = 0; i < AURA_STAKING_CONTRACTS.length; i++) {
    pushTokenRecordArray(
      records,
      getAuraStakedBalanceFromWallets(
        timestamp,
        AURA_STAKING_CONTRACTS[i],
        stakedTokenAddress,
        rate,
        multiplier,
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
  const tokenSnapshot = getOrCreateERC20TokenSnapshot(contractAddress, blockNumber);

  if (!tokenSnapshot || tokenSnapshot.totalSupply === null) {
    return null;
  }

  // No matching allocator id
  if (allocatorId == ALLOCATOR_RARI_ID_NOT_FOUND || !tokeAllocator) {
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

  return toDecimal(tokeAllocator.tokeDeposited(), tokenSnapshot.decimals);
}

/**
 * Returns the balance of {contractAddress} in the Toke Allocator.
 *
 * @param metricName The name of the current metric, which is used for entity ids
 * @param tokenAddress ERC20 contract to find the balance of
 * @param price
 * @param blockNumber the current block number
 * @returns TokenRecord array
 */
export function getTokeAllocatorRecords(
  timestamp: BigInt,
  tokenAddress: string,
  price: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const balance = getTokeAllocatorBalance(tokenAddress, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  records.push(
    createOrUpdateTokenRecord(
      timestamp,
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(TOKE_ALLOCATOR),
      TOKE_ALLOCATOR,
      price,
      balance,
      blockNumber,
      getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
      ERC20_TOKENS,
      BLOCKCHAIN,
    ),
  );

  return records;
}

// Source: https://www.tally.xyz/governance/eip155:1:0x0BEF27FEB58e857046d630B2c03dFb7bae567494/proposal/54737972228715148291831450377954475770670423675395942151334883116464258243647
const RARI_DEBT_WRITEOFF_BLOCK = "14983058";

/**
 * Returns the balance for a given contract in the Rari Allocator.
 *
 * If the contract does not have an entry in the Rari Allocator,
 * null is returned.
 *
 * If the block is after {RARI_DEBT_WRITEOFF_BLOCK} (the block at which the Fuse repay bad debt proposal was defeated),
 * the amount returned will be 0.
 *
 * @param contractAddress the contract to look up
 * @param blockNumber the current block number
 * @returns BigDecimal or null
 */
function getRariAllocatorBalance(contractAddress: string, blockNumber: BigInt): BigDecimal | null {
  const rariAllocatorId = getRariAllocatorId(contractAddress);
  const rariAllocator = getRariAllocator(RARI_ALLOCATOR, blockNumber);
  const tokenSnapshot = getOrCreateERC20TokenSnapshot(contractAddress, blockNumber);

  if (!tokenSnapshot || tokenSnapshot.totalSupply === null) {
    return null;
  }

  if (rariAllocatorId == ALLOCATOR_RARI_ID_NOT_FOUND || !rariAllocator) {
    return null;
  }

  if (rariAllocator.try_ids().reverted) {
    log.warning("getRariAllocatorBalance: Rari Allocator contract reverted at block {}. Skipping", [
      blockNumber.toString(),
    ]);
    return null;
  }

  // Correct allocator for the id
  if (!rariAllocator.ids().includes(BigInt.fromI32(rariAllocatorId))) {
    return null;
  }

  if (blockNumber.gt(BigInt.fromString(RARI_DEBT_WRITEOFF_BLOCK))) {
    log.info("getRariAllocatorBalance: Current block {} is after write-off block {}. Skipping", [
      blockNumber.toString(),
      RARI_DEBT_WRITEOFF_BLOCK,
    ]);
    return null;
  }

  return toDecimal(
    rariAllocator.amountAllocated(BigInt.fromI32(rariAllocatorId)),
    tokenSnapshot.decimals,
  );
}

/**
 * Returns the balance of {contractAddress} in the Rari Allocator.
 *
 * @param metricName The name of the current metric, which is used for entity ids
 * @param tokenAddress ERC20 contract to find the balance of
 * @param price
 * @param blockNumber the current block number
 * @returns TokenRecord array
 */
export function getRariAllocatorRecords(
  timestamp: BigInt,
  tokenAddress: string,
  price: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const balance = getRariAllocatorBalance(tokenAddress, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  records.push(
    createOrUpdateTokenRecord(
      timestamp,
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(RARI_ALLOCATOR),
      RARI_ALLOCATOR,
      price,
      balance,
      blockNumber,
      getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
      ERC20_TOKENS,
      BLOCKCHAIN,
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
 * @returns TokenRecord array
 */
export function getOnsenAllocatorRecords(
  timestamp: BigInt,
  tokenAddress: string,
  price: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const balance = getOnsenBalance(tokenAddress, ONSEN_ALLOCATOR, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  records.push(
    createOrUpdateTokenRecord(
      timestamp,
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(ONSEN_ALLOCATOR),
      ONSEN_ALLOCATOR,
      price,
      balance,
      blockNumber,
      getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
      ERC20_TOKENS,
      BLOCKCHAIN,
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
  if (addressesEqual(tokenAddress, NATIVE_ETH)) {
    log.info("getConvexStakedBalance: native ETH is unsupported", []);
    return null;
  }

  // Ignore if we're looping through and the staking token doesn't match
  const stakingSnapshot = getOrCreateConvexStakingPoolSnapshot(stakingAddress, blockNumber);
  const stakingSnapshotToken = stakingSnapshot.stakingToken;
  if (stakingSnapshotToken === null || !addressesEqual(stakingSnapshotToken.toHexString(), tokenAddress)) {
    return null;
  }

  const tokenSnapshot = getOrCreateERC20TokenSnapshot(tokenAddress, blockNumber);
  if (!tokenSnapshot || tokenSnapshot.totalSupply === null) {
    return null;
  }

  // Get balance
  const stakingContract = ConvexBaseRewardPool.bind(Address.fromString(stakingAddress));
  const balance = stakingContract.balanceOf(Address.fromString(allocatorAddress));
  const decimalBalance = toDecimal(balance, tokenSnapshot.decimals);
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
 * Determines the balance of a Curve token
 * locked in Frax from the given allocator.
 *
 * @param tokenAddress
 * @param allocatorAddress
 * @param lockingAddress
 * @param blockNumber
 * @returns
 */
export function getFraxLockedBalance(
  tokenAddress: string,
  allocatorAddress: string,
  lockingAddress: string,
  blockNumber: BigInt,
): BigDecimal | null {
  // Unsupported
  if (addressesEqual(tokenAddress, NATIVE_ETH)) {
    log.info("getFraxLockedBalance: native ETH is unsupported", []);
    return null;
  }

  // Ignore if we're looping through and the staking token doesn't match
  const stakingSnapshot = getOrCreateFraxStakingPoolSnapshot(lockingAddress, blockNumber);
  const stakingSnapshotToken = stakingSnapshot.stakingToken;
  if (stakingSnapshotToken === null || !addressesEqual(stakingSnapshotToken.toHexString(), tokenAddress)) {
    return null;
  }

  const tokenSnapshot = getOrCreateERC20TokenSnapshot(tokenAddress, blockNumber);
  if (!tokenSnapshot || tokenSnapshot.totalSupply === null) {
    return null;
  }

  // Get balance
  const lockingContract = FraxFarm.bind(Address.fromString(lockingAddress));
  const balance = lockingContract.lockedLiquidityOf(Address.fromString(allocatorAddress));
  const decimalBalance = toDecimal(balance, tokenSnapshot.decimals);
  log.debug(
    "getFraxLockedBalance: Balance of {} for locking token {} ({}) and allocator {} ({})",
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
  timestamp: BigInt,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

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

      records.push(
        createOrUpdateTokenRecord(
          timestamp,
          getContractName(tokenAddress, getContractName(stakingAddress)),
          tokenAddress,
          getContractName(allocatorAddress),
          allocatorAddress,
          getUSDRate(tokenAddress, blockNumber),
          balance,
          blockNumber,
          getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
          ERC20_TOKENS,
          BLOCKCHAIN,
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

  if (addressesEqual(tokenAddress, ERC20_LUSD)) {
    const lusdBalance = toDecimal(
      allocator.amountAllocated(BigInt.fromI32(getRariAllocatorId(ERC20_LUSD))),
    );
    log.info("getLiquityStabilityPoolBalance: found LUSD balance of {} at block {}", [
      lusdBalance.toString(),
      blockNumber.toString(),
    ]);
    return lusdBalance;
  }

  if (addressesEqual(tokenAddress, ERC20_WETH)) {
    const wethBalance = toDecimal(allocator.getETHRewards());
    log.info("getLiquityStabilityPoolBalance: found wETH balance of {} at block {}", [
      wethBalance.toString(),
      blockNumber.toString(),
    ]);
    return wethBalance;
  }

  if (addressesEqual(tokenAddress, ERC20_LQTY)) {
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
  timestamp: BigInt,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const balance = getLiquityStabilityPoolBalance(LUSD_ALLOCATOR, tokenAddress, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  log.info(
    "getLiquityStabilityPoolRecords: Found balance {} of token {} in Liquity allocator at block {}",
    [balance.toString(), getContractName(tokenAddress), blockNumber.toString()],
  );
  records.push(
    createOrUpdateTokenRecord(
      timestamp,
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(LUSD_ALLOCATOR),
      LUSD_ALLOCATOR,
      rate,
      balance,
      blockNumber,
      getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
      ERC20_TOKENS,
      BLOCKCHAIN,
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
  log.debug(
    "getVeFXSAllocatorBalance: determining staked balance for allocator {} ({}) and token {} ({}) at block {}",
    [
      getContractName(allocatorAddress),
      allocatorAddress,
      getContractName(tokenAddress),
      tokenAddress,
      blockNumber.toString(),
    ],
  );

  // Only VeFXS supported
  if (!addressesEqual(tokenAddress, ERC20_FXS_VE)) {
    log.debug("getVeFXSAllocatorBalance: token {} ({}) is not supported", [
      getContractName(tokenAddress),
      tokenAddress,
    ]);
    return null;
  }

  const contract = getVeFXS(tokenAddress, blockNumber);
  if (!contract) {
    log.debug("getVeFXSAllocatorBalance: cannot bind to veFXS contract", []);
    return null;
  }

  return toDecimal(contract.locked(Address.fromString(allocatorAddress)).value0, 18);
}

export function getVeFXSAllocatorRecords(
  timestamp: BigInt,
  tokenAddress: string,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const balance = getVeFXSAllocatorBalance(tokenAddress, VEFXS_ALLOCATOR, blockNumber);
  if (!balance || balance.equals(BigDecimal.zero())) return records;

  const fxsRate = getUSDRate(ERC20_FXS, blockNumber);

  log.info(
    "getVeFXSAllocatorRecords: Found balance {} of token {} in veFXS allocator at block {}",
    [balance.toString(), getContractName(tokenAddress), blockNumber.toString()],
  );
  records.push(
    createOrUpdateTokenRecord(
      timestamp,
      getContractName(tokenAddress),
      tokenAddress,
      getContractName(VEFXS_ALLOCATOR),
      VEFXS_ALLOCATOR,
      fxsRate,
      balance,
      blockNumber,
      getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
      ERC20_TOKENS,
      BLOCKCHAIN,
    ),
  );

  return records;
}

function getVlCvxUnlockedBalance(
  tokenAddress: string,
  allocatorAddress: string,
  _blockNumber: BigInt,
): BigDecimal | null {
  // Only vlCVX supported
  if (tokenAddress != ERC20_CVX_VL_V2) return null;

  const contract = vlCVX.bind(Address.fromString(tokenAddress));
  if (!contract) return null;

  if (contract.try_lockedBalances(Address.fromString(allocatorAddress)).reverted) {
    return null;
  }

  const balances = contract.lockedBalances(Address.fromString(allocatorAddress));

  return toDecimal(balances.getUnlockable(), contract.decimals());
}

/**
 * Returns the records of unlocked (but not withdrawn) vlCVX.
 *
 * @param metricName
 * @param tokenAddress
 * @param rate
 * @param blockNumber
 * @returns
 */
export function getVlCvxUnlockedRecords(
  timestamp: BigInt,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt,
): TokenRecord[] {
  const records: TokenRecord[] = [];

  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];

    const balance = getVlCvxUnlockedBalance(tokenAddress, currentWallet, blockNumber);
    if (!balance || balance.equals(BigDecimal.zero())) continue;

    records.push(
      createOrUpdateTokenRecord(
        timestamp,
        "Convex - Unlocked (vlCVX)", // Manual override
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
        getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
        ERC20_TOKENS,
        BLOCKCHAIN,
      ),
    );
  }

  return records;
}

function getMakerDSRBalance(contract: MakerDSR, wallet: string): BigDecimal {
  // This is helpful: https://twitter.com/MakerDAO/status/1621216032504291329
  // Convert from DSR shares to DAI
  return contract.pie(Address.fromString(wallet)).times(contract.chi()).divDecimal(BigInt.fromI32(10).pow(27).toBigDecimal())
    // Convert to decimal
    .div(BigInt.fromI32(10).pow(18).toBigDecimal());
}

export function getMakerDSRRecords(
  timestamp: BigInt,
  tokenAddress: string,
  rate: BigDecimal,
  blockNumber: BigInt
): TokenRecord[] {
  const records: TokenRecord[] = [];

  // DAI only
  if (tokenAddress.toLowerCase() != ERC20_DAI.toLowerCase()) {
    return records;
  }

  const dsrContract = MakerDSR.bind(Address.fromString(MAKER_DSR));
  const wallets = getWalletAddressesForContract(tokenAddress);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];

    const balance = getMakerDSRBalance(dsrContract, currentWallet);
    if (!balance || balance.equals(BigDecimal.zero())) continue;

    records.push(
      createOrUpdateTokenRecord(
        timestamp,
        "DAI - Deposited in DSR", // Manual override
        tokenAddress,
        getContractName(currentWallet),
        currentWallet,
        rate,
        balance,
        blockNumber,
        getIsTokenLiquid(tokenAddress, ERC20_TOKENS),
        ERC20_TOKENS,
        BLOCKCHAIN,
      ),
    );
  }

  return records;
}