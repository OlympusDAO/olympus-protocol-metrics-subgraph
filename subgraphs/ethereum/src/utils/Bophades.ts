import { Address, BigInt, ByteArray, Bytes, dataSource, log } from "@graphprotocol/graph-ts";
import { BophadesKernel } from "../../generated/ProtocolMetrics/BophadesKernel";
import { BophadesTreasury } from "../../generated/ProtocolMetrics/BophadesTreasury";
import { BophadesModule } from "../../generated/schema";

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
