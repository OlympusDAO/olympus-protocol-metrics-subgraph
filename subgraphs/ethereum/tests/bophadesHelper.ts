import { Address, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction, log } from "matchstick-as";

export function mockTreasuryAddressNull(): void {
  // Mock the Bophades Kernel contract to revert and hence return null
  const kernelAddress = Address.fromString("0x2286d7f9639e8158FaD1169e76d1FbC38247f54b");

  createMockedFunction(
    kernelAddress,
    "getModuleForKeycode",
    "getModuleForKeycode(bytes5):(address)"
  ).withArgs(
    [
      ethereum.Value.fromFixedBytes(Bytes.fromUTF8("TRSRY")),
    ],
  ).reverts();
  log.debug("mockTreasuryAddressNull: mocked null TRSRY address", []);
}
