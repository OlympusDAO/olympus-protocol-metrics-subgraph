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
  { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const SUSDS = "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD" as const;
const BOPHADES = "0xa8687a15d4be32cc8f0a8a7b9704a4c3993d9613" as const;

async function main() {
  const blocks = [25_137_600n, 25_139_600n];
  for (const block of blocks) {
    const bal = await c.readContract({
      address: SUSDS,
      abi: ERC20,
      functionName: "balanceOf",
      args: [BOPHADES],
      blockNumber: block,
    });
    console.log(`block ${block}: balanceOf(Bophades, sUSDS) = ${Number(bal) / 1e18}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
