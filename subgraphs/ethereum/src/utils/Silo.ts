import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { TokenSupply } from "../../../shared/generated/schema";
import { ERC20 } from "../../generated/ProtocolMetrics/ERC20";
import { ERC20_OHM_V2, getContractName, getWalletAddressesForContract } from "./Constants";
import { toDecimal } from "../../../shared/src/utils/Decimals";
import { TYPE_LENDING, createOrUpdateTokenSupply } from "../../../shared/src/utils/TokenSupplyHelper";

// Hard-coding this for now. If we wanted this to be generalisable, we would use the Silo Repository contract.
const SILO_OHM_COLLATERAL_TOKEN = "0x907136B74abA7D5978341eBA903544134A66B065";

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
      createOrUpdateTokenSupply(
        timestamp,
        getContractName(ERC20_OHM_V2),
        ERC20_OHM_V2,
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