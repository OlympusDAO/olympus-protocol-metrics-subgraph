import { readFileSync } from "node:fs";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

for (const line of readFileSync(
  "/Users/zach/Documents/repos/olympus/olympus-protocol-metrics-subgraph/.env",
  "utf8",
).split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (match) process.env[match[1]] = match[2];
}

const c = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ENVIO_ETHEREUM_RPC_URL),
});

const ERC20 = [
  { type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const ERC4626 = [
  { type: "function", name: "convertToAssets", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const AETH_SUSDE = "0x4579a27af00a62c0eb156349f31b345c08386419" as const; // Aave V3 sUSDe supply receipt
const SUSDE = "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497" as const; // sUSDe vault
const YIELD_FARMING_MS = "0x2075e3b46470cfcE124Daaf52b46Dcf965727Dd1" as const;

async function main() {
  // 2026-04-08 latest snapshot block on Ethereum ~ end of day
  const blocks = [24_851_400n /* 2026-04-08 ~end */, 25_137_600n /* 2026-05-20 */];
  for (const block of blocks) {
    try {
      const [name, symbol, decimals, bal] = await Promise.all([
        c.readContract({ address: AETH_SUSDE, abi: ERC20, functionName: "name", blockNumber: block }),
        c.readContract({ address: AETH_SUSDE, abi: ERC20, functionName: "symbol", blockNumber: block }),
        c.readContract({ address: AETH_SUSDE, abi: ERC20, functionName: "decimals", blockNumber: block }),
        c.readContract({ address: AETH_SUSDE, abi: ERC20, functionName: "balanceOf", args: [YIELD_FARMING_MS], blockNumber: block }),
      ]);
      const balDec = Number(bal) / 10 ** Number(decimals);
      // Price via sUSDe.convertToAssets(1e18) — gives USDe per sUSDe
      const usdePerSusde = await c.readContract({
        address: SUSDE,
        abi: ERC4626,
        functionName: "convertToAssets",
        args: [10n ** 18n],
        blockNumber: block,
      });
      const rate = Number(usdePerSusde) / 1e18; // USDe per sUSDe (~$1 per USDe assumed)
      console.log(`block ${block}: ${symbol} (${name}, ${decimals} dec)`);
      console.log(`  balanceOf(Yield Farming MS) = ${balDec}`);
      console.log(`  sUSDe.convertToAssets(1e18) = ${rate} USDe/sUSDe`);
      console.log(`  approx value (assuming $1 USDe) = $${(balDec * rate).toFixed(2)}`);
    } catch (e: any) {
      console.log(`block ${block}: error: ${e?.message || e}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
