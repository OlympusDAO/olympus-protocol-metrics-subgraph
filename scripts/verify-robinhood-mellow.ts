// Read-only evidence replay. Requires historical state; never signs or submits.
// pnpm exec tsx scripts/verify-robinhood-mellow.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createPublicClient, erc20Abi, getAddress, http } from "viem";
import { MELLOW_ABI } from "../apps/indexer/src/snapshot/abis/mellow";

const client = createPublicClient({ transport: http(process.env.ENVIO_ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com") });
const blockNumber = 65044796n;
const wallet = getAddress("0x317e0F5EF883DB95f8fFB5B995b8457903873608");
const asset = getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const shares = getAddress("0xf04c58853D54f2445989108C29087F1A61C034cB");
const redeem = getAddress("0x873ff30c29450bf4bEB3AfBBB0372a4b47b4969C");
assert.equal(await client.getChainId(), 4663);
assert.equal((await client.getBlock({ blockNumber })).timestamp, 1789615687n);
assert.equal(await client.readContract({ address: asset, abi: erc20Abi, functionName: "balanceOf", args: [wallet], blockNumber }), 0n);
assert.equal(await client.readContract({ address: shares, abi: MELLOW_ABI, functionName: "sharesOf", args: [wallet], blockNumber }), 0n);
assert.deepEqual(await client.readContract({ address: redeem, abi: MELLOW_ABI, functionName: "requestsOf", args: [wallet, 0n, 100n], blockNumber }), []);

const implementations = [
  [shares, "0x00000000C534B8680e3aa7165DeDc3Ab8781f602", "4133a63d48e447364b8384694f1f05c025c748c6e55694e4140ab879ca962322"],
  ["0x4Cb16151eB97Ec29D3fDfc79CCe2233500A80389", "0x000000001cc8c3e40856e956db870095ef6c98bd", "e45e71b1dcc7247b59fe268df1b098128a7166b381dca23addbcfdf51ffdece6"],
  [redeem, "0x0000000045d70ee8145135f08309ff5b1a63d43f", "9aa40259b94e71477ff8dc15cc6f8a7e065c1601dd3c43d663dd2bb81a68b2da"],
  ["0x4336739985da716436460f8E644c03120d334521", "0x000000009adE4dAE1f868775A3f087945983f062", "5036ea89f46cf0414aac1d99316d986caef5e735378f5c92127f1d5c78e9f87a"],
] as const;
for (const [proxy, implementation, expectedHash] of implementations) {
  const slot = await client.getStorageAt({ address: getAddress(proxy), slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", blockNumber });
  assert.equal(`0x${slot?.slice(-40)}`, implementation.toLowerCase());
  const bytecode = await client.getCode({ address: getAddress(implementation), blockNumber });
  assert.ok(bytecode && bytecode !== "0x");
  assert.equal(createHash("sha256").update(bytecode).digest("hex"), expectedHash);
}
console.log("PASS: Robinhood empty-position baseline and four verified implementation bytecodes at block 65044796");
