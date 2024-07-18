import { Address, BigInt, ByteArray, Bytes, dataSource, log } from "@graphprotocol/graph-ts";
import { BophadesKernel } from "../../generated/ProtocolMetrics/BophadesKernel";
import { BophadesTreasury } from "../../generated/ProtocolMetrics/BophadesTreasury";
import { BophadesModule, ClearinghouseAddress } from "../../generated/schema";
import { BophadesClearinghouseRegistry } from "../../generated/ProtocolMetrics/BophadesClearinghouseRegistry";

const KERNEL_MAP = new Map<string, string>();
KERNEL_MAP.set("mainnet", "0x2286d7f9639e8158FaD1169e76d1FbC38247f54b");
KERNEL_MAP.set("goerli", "0xDb7cf68154bd422dF5196D90285ceA057786b4c3");

function getKernelAddress(): Address {
  if (!KERNEL_MAP.has(dataSource.network())) {
    throw new Error("Unknown network: " + dataSource.network());
  }

  const kernelAddress = KERNEL_MAP.get(dataSource.network());
  log.debug("getKernelAddress: kernel address: {}", [kernelAddress]);
  return Address.fromString(kernelAddress);
}

function getBophadesModuleAddress(keycode: string, blockNumber: BigInt): Address | null {
  // Keycode/blockNumber
  const moduleId = Bytes.fromUTF8(keycode).concatI32(blockNumber.toI32());

  // If it exists
  const existingModule = BophadesModule.load(moduleId);
  if (existingModule !== null) {
    log.debug("getBophadesModuleAddress: using cached module address: {}", [existingModule.moduleAddress.toHexString()]);
    return Address.fromBytes(existingModule.moduleAddress);
  }

  // Otherwise

  // Get the kernel and module address
  log.debug("getBophadesModuleAddress: getting module address for keycode: {}", [keycode]);
  const kernelAddress = getKernelAddress();
  const kernelContract = BophadesKernel.bind(kernelAddress);
  const moduleAddressResult = kernelContract.try_getModuleForKeycode(Bytes.fromByteArray(ByteArray.fromUTF8(keycode)));
  if (moduleAddressResult.reverted) {
    log.debug("getBophadesModuleAddress: unable to get module for keycode: {}", [keycode]);
    return null;
  }

  // Cache it
  const module = new BophadesModule(moduleId);
  module.block = blockNumber;
  module.keycode = keycode;
  module.moduleAddress = moduleAddressResult.value;
  module.save();

  log.debug("getBophadesModuleAddress: module address for keycode {}: {}", [keycode, moduleAddressResult.value.toHexString()]);
  return moduleAddressResult.value;
}

/**
 * Determines the Bophades treasury address.
 *
 * This is done dynamically using the Bophades Kernel contract,
 * as the Treasury module can be upgraded and the Kernel is less likely to be.
 *
 * @returns
 */
export function getTreasuryAddress(blockNumber: BigInt): Address | null {
  return getBophadesModuleAddress("TRSRY", blockNumber);
}

export function getTRSRY(blockNumber: BigInt): BophadesTreasury | null {
  const trsryAddress = getTreasuryAddress(blockNumber);
  if (trsryAddress === null) {
    return null;
  };

  return BophadesTreasury.bind(trsryAddress);
}

function getClearinghouseRegistryAddress(blockNumber: BigInt): Address | null {
  return getBophadesModuleAddress("CHREG", blockNumber);
}

/**
 * Obtains the addresses of all registered Clearinghouses.
 *
 * @param blockNumber
 * @returns
 */
export function getClearinghouseAddresses(blockNumber: BigInt): Address[] {
  const registryAddress = getClearinghouseRegistryAddress(blockNumber);

  // If the module isn't registered, return an empty array
  if (registryAddress === null) {
    return [];
  }

  // If there is a result for the current block, return it
  const recordId: Bytes = registryAddress.concatI32(blockNumber.toI32());
  const existingAddresses = ClearinghouseAddress.load(recordId);
  if (existingAddresses !== null) {
    const addresses: Address[] = new Array<Address>();
    for (let i = 0; i < existingAddresses.addresses.length; i++) {
      addresses.push(Address.fromBytes(existingAddresses.addresses[i]));
    }

    log.info("getClearinghouseAddresses: using cached addresses for block: {}", [blockNumber.toString()]);
    return addresses;
  }

  // Otherwise, get the addresses from the registry
  const registryContract = BophadesClearinghouseRegistry.bind(registryAddress);

  const addresses: Address[] = new Array<Address>();

  // Get the number of clearinghouses
  const clearinghouseCountResult = registryContract.try_registryCount();

  // If it doesn't revert
  if (!clearinghouseCountResult.reverted) {
    // Iterate through the index and fetch the clearinghouse addresses
    for (let i = 0; i < clearinghouseCountResult.value.toI32(); i++) {
      const registeredAddress = registryContract.registry(BigInt.fromI32(i));
      addresses.push(registeredAddress);
    }
    log.info("getClearinghouseAddresses: fetched addresses for block: {}", [blockNumber.toString()]);
  }
  // If it reverts
  else {
    // Most likely CHREG isn't yet available
    log.warning("getClearinghouseAddresses: unable to get clearinghouse count for block: {}", [blockNumber.toString()]);
  }

  // Re-format as bytes array
  const bytesAddresses: Bytes[] = new Array<Bytes>();
  for (let i = 0; i < addresses.length; i++) {
    bytesAddresses.push(addresses[i]);
  }

  // Create a record of the addresses
  const record = new ClearinghouseAddress(recordId);
  record.block = blockNumber;
  record.addresses = bytesAddresses;
  record.save();

  log.info("getClearinghouseAddresses: cached addresses for block: {}", [blockNumber.toString()]);
  return addresses;
}
