import { readFileSync } from "node:fs";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

for (const line of readFileSync(
  "/Users/zach/Documents/repos/olympus/olympus-protocol-metrics-subgraph/.env",
  "utf8",
).split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (match) process.env[match[1]] = match[2];
}

const c = createPublicClient({
  chain: base,
  transport: http(process.env.ENVIO_BASE_RPC_URL),
});

const ERC20 = [
  { type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const OHM_BASE = "0x060cb087a9730e13aa191f31a6d86bff8dfcdcc0" as const;
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const;
const DAO_MS = "0x18a390bd45bcc92652b9a91ad51aed7f1c1358f5" as const;
const BLOCK = 46252827n;
const NFPM_BASE = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1" as const; // Uniswap V3 NonfungiblePositionManager on Base

async function main() {
  const [name, symbol, ohmBal, usdcBal] = await Promise.all([
    c.readContract({ address: OHM_BASE, abi: ERC20, functionName: "name", blockNumber: BLOCK }),
    c.readContract({ address: OHM_BASE, abi: ERC20, functionName: "symbol", blockNumber: BLOCK }),
    c.readContract({ address: OHM_BASE, abi: ERC20, functionName: "balanceOf", args: [DAO_MS], blockNumber: BLOCK }),
    c.readContract({ address: USDC_BASE, abi: ERC20, functionName: "balanceOf", args: [DAO_MS], blockNumber: BLOCK }),
  ]);
  console.log({ token_at_OHM_BASE: { name, symbol } });
  console.log("DAO MS wallet direct balances at block " + BLOCK + ":");
  console.log("  OHM:  " + Number(ohmBal) / 1e9);
  console.log("  USDC: " + Number(usdcBal) / 1e6);
}

main().catch((e) => { console.error(e); process.exit(1); });
