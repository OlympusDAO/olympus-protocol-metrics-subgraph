import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenSupply } from "../../../shared/generated/schema";
import { SiloRepository } from "../../generated/TokenRecords-arbitrum/SiloRepository";
import { ERC20_OHM } from "./Constants";
import { Silo } from "../../generated/TokenRecords-arbitrum/Silo";
import { ERC20 } from "../../generated/TokenRecords-arbitrum/ERC20";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { TYPE_LENDING, createOrUpdateTokenSupply } from "../../../shared/src/utils/TokenSupplyHelper";
import { getContractName, getWalletAddressesForContract } from "./Contracts";

export function getSiloSupply(timestamp: BigInt, siloRepositoryAddress: string, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  // Get the Silo from the Silo repository
  const siloRepository = SiloRepository.bind(Address.fromString(siloRepositoryAddress));
  const siloResult = siloRepository.try_getSilo(Address.fromString(ERC20_OHM));
  if (siloResult.reverted) {
    log.debug("getSiloSupply: getSilo reverted", []);
    return records;
  }

  const siloAddress = siloResult.value;
  const silo = Silo.bind(siloAddress);

  // Get the address of the token minted when depositing OHM
  const siloAssets = silo.getAssetsWithState();
  if (siloAssets.getAssetsStorage().length == 0) {
    return records;
  }

  const collateralToken = siloAssets.getAssetsStorage()[0].collateralToken;
  const collateralTokenContract = ERC20.bind(collateralToken);

  // Iterate over wallets to find the balances
  const wallets = getWalletAddressesForContract(siloAddress.toHexString());
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];
    const balanceResult = collateralTokenContract.try_balanceOf(Address.fromString(currentWallet));
    if (balanceResult.reverted) {
      return records;
    }

    const balance = toDecimal(balanceResult.value, collateralTokenContract.decimals());
    if (balance.equals(BigDecimal.zero())) {
      continue;
    }

    log.info("getSiloSupply: Silo OHM balance {} for wallet {}", [balance.toString(), getContractName(currentWallet)]);
    records.push(
      createOrUpdateTokenSupply(
        timestamp,
        getContractName(ERC20_OHM),
        ERC20_OHM,
        "Silo",
        siloAddress.toHexString(),
        getContractName(currentWallet),
        currentWallet,
        TYPE_LENDING,
        balance,
        blockNumber,
        -1, // Subtract, as this represents OHM taken out of supply
      ),
    );
  }

  return records;
}