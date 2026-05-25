// Audits every `addr("0x…")` constant in src/snapshot/chains/*.ts against
// on-chain reality. For each ERC20-like address, calls symbol() / name() /
// decimals() and prints any mismatch between the variable name and what
// the contract returns. Non-ERC20 contracts (wallets, multisigs, NFT
// position managers, pool managers, etc.) are exercised with `getCode` to
// confirm something is deployed at that address; intent-checking those
// requires per-address knowledge so we just flag empty bytecode.

import { readFileSync, readdirSync } from "node:fs";
import { createPublicClient, getAddress, http } from "viem";
import * as chains from "viem/chains";

for (const line of readFileSync(
  "/Users/zach/Documents/repos/olympus/olympus-protocol-metrics-subgraph/.env",
  "utf8",
).split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (match) process.env[match[1]] = match[2];
}

const ERC20 = [
  { type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
] as const;

const CHAIN_CLIENTS: Record<string, ReturnType<typeof createPublicClient>> = {
  ethereum: createPublicClient({ chain: chains.mainnet, transport: http(process.env.ENVIO_ETHEREUM_RPC_URL) }),
  arbitrum: createPublicClient({ chain: chains.arbitrum, transport: http(process.env.ENVIO_ARBITRUM_RPC_URL) }),
  base: createPublicClient({ chain: chains.base, transport: http(process.env.ENVIO_BASE_RPC_URL) }),
  polygon: createPublicClient({ chain: chains.polygon, transport: http(process.env.ENVIO_POLYGON_RPC_URL) }),
  fantom: createPublicClient({ chain: chains.fantom, transport: http(process.env.ENVIO_FANTOM_RPC_URL) }),
  berachain: createPublicClient({
    chain: { ...chains.mainnet, id: 80094, name: "Berachain", rpcUrls: { default: { http: ["https://rpc.berachain.com"] } } } as any,
    transport: http(process.env.ENVIO_BERACHAIN_RPC_URL),
  }),
};

type Entry = { chain: string; varName: string; address: string };

function parseChainFile(chain: string, filename: string): Entry[] {
  const src = readFileSync(filename, "utf8");
  const entries: Entry[] = [];
  // Matches `const X = addr("0x…");` — covers all uppercase / snake-case constants.
  const re = /^const\s+([A-Z][A-Z0-9_]*)\s*=\s*addr\("(0x[0-9a-fA-F]{40})"\)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    entries.push({ chain, varName: m[1], address: m[2] });
  }
  return entries;
}

async function probeToken(
  client: ReturnType<typeof createPublicClient>,
  address: string,
): Promise<
  | { kind: "erc20"; name: string; symbol: string; decimals: number }
  | { kind: "contract" }
  | { kind: "empty" }
  | { kind: "error"; reason: string }
> {
  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({ address: getAddress(address), abi: ERC20, functionName: "name" }).catch(() => null),
      client.readContract({ address: getAddress(address), abi: ERC20, functionName: "symbol" }).catch(() => null),
      client.readContract({ address: getAddress(address), abi: ERC20, functionName: "decimals" }).catch(() => null),
    ]);
    if (name !== null && symbol !== null && decimals !== null) {
      return { kind: "erc20", name: String(name), symbol: String(symbol), decimals: Number(decimals) };
    }
    const code = await client.getCode({ address: getAddress(address) });
    if (code && code !== "0x") return { kind: "contract" };
    return { kind: "empty" };
  } catch (e: unknown) {
    return { kind: "error", reason: String((e as Error)?.message ?? e).slice(0, 100) };
  }
}

// Heuristic: does varName "look like" the symbol the contract returned?
// We match if any /[a-z0-9]+/ chunk of the lowercased varName appears in the
// lowercased symbol, or vice versa. Catches things like ERC20_OHM_V2 ↔ "OHM"
// and ERC20_USDC ↔ "USDC". Flags real mismatches like ERC20_DAI ↔ "USDT".
function looksConsistent(varName: string, symbol: string): boolean {
  const tokens = varName.toLowerCase().split(/[_]+/).filter((t) => t.length >= 2);
  const sym = symbol.toLowerCase();
  for (const t of tokens) {
    if (t === "erc20" || t === "lp" || t === "v1" || t === "v2" || t === "v3") continue;
    if (sym.includes(t) || t.includes(sym)) return true;
  }
  return false;
}

async function main() {
  const chainDir = "/Users/zach/Documents/repos/olympus/olympus-protocol-metrics-subgraph/src/snapshot/chains";
  const files = readdirSync(chainDir).filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "rpc.ts");

  const allEntries: Entry[] = [];
  for (const f of files) {
    const chain = f.replace(/\.ts$/, "");
    if (!(chain in CHAIN_CLIENTS)) continue;
    allEntries.push(...parseChainFile(chain, `${chainDir}/${f}`));
  }
  console.log(`# Parsed ${allEntries.length} addr() constants across ${Object.keys(CHAIN_CLIENTS).length} chains.\n`);

  const issues: string[] = [];
  for (const e of allEntries) {
    const client = CHAIN_CLIENTS[e.chain];
    const probe = await probeToken(client, e.address);

    if (probe.kind === "empty") {
      issues.push(`EMPTY ${e.chain}/${e.varName} = ${e.address} — no bytecode at address`);
      console.log(`  EMPTY ${e.chain}/${e.varName} = ${e.address}`);
      continue;
    }
    if (probe.kind === "error") {
      issues.push(`ERR   ${e.chain}/${e.varName} = ${e.address} — ${probe.reason}`);
      console.log(`  ERR   ${e.chain}/${e.varName} = ${e.address} — ${probe.reason}`);
      continue;
    }
    if (probe.kind === "contract") {
      // Non-ERC20 contract — could be multisig, pool, etc. Just log.
      console.log(`  OK?   ${e.chain}/${e.varName} = ${e.address} — contract (no symbol)`);
      continue;
    }
    // erc20
    const ok = looksConsistent(e.varName, probe.symbol);
    const tag = ok ? "OK   " : "FLAG ";
    console.log(`  ${tag} ${e.chain}/${e.varName} = ${e.address} — symbol="${probe.symbol}" decimals=${probe.decimals}`);
    if (!ok) {
      issues.push(`MISMATCH ${e.chain}/${e.varName} = ${e.address} — symbol="${probe.symbol}"`);
    }
  }

  console.log(`\n# ${issues.length} issues:`);
  for (const i of issues) console.log(`  ${i}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
