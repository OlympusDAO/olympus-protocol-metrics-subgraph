import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenSupply } from "../../../shared/generated/schema";
import { ERC20_OHM } from "./Constants";
import { ERC20 } from "../../generated/TokenRecords-arbitrum/ERC20";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { TYPE_LENDING, createTokenSupply } from "../../../shared/src/utils/TokenSupplyHelper";
import { getContractName, getWalletAddressesForContract } from "./Contracts";

// Hard-coding this for now. If we wanted this to be generalisable, we would use the Silo Repository contract.
const SILO_OHM_COLLATERAL_TOKEN = "0xD8102963c400fEDBbc23Fe92f1b09c0C561e77Ae";

export function getSiloSupply(timestamp: BigInt, blockNumber: BigInt): TokenSupply[] {
  const records: TokenSupply[] = [];

  const collateralTokenContract = ERC20.bind(Address.fromString(SILO_OHM_COLLATERAL_TOKEN));
  const collateralTokenDecimalsResult = collateralTokenContract.try_decimals();
  if (collateralTokenDecimalsResult.reverted) {
    return records;
  }
  const collateralTokenDecimals = collateralTokenDecimalsResult.value;

  // Iterate over wallets to find the balances
  const wallets = getWalletAddressesForContract(SILO_OHM_COLLATERAL_TOKEN);
  for (let i = 0; i < wallets.length; i++) {
    const currentWallet = wallets[i];

    const balance = toDecimal(
      collateralTokenContract.balanceOf(Address.fromString(currentWallet)), collateralTokenDecimals);
    if (balance.equals(BigDecimal.zero())) {
      continue;
    }

    log.info("getSiloSupply: Silo OHM balance {} for wallet {}", [balance.toString(), getContractName(currentWallet)]);
    records.push(
      createTokenSupply(
        timestamp,
        getContractName(ERC20_OHM),
        ERC20_OHM,
        "Silo",
        SILO_OHM_COLLATERAL_TOKEN,
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