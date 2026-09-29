# Measuring liquidity

How to get the numbers each gate needs. Coverage below was verified on 2026-09-28;
if a source that is listed as working fails, re-probe before concluding "no data".

Every number you use goes into the evidence table with: source (URL or command),
value, and UTC timestamp. All dates are UTC.

## Position and mark

The published metrics API has one row per token per holding wallet.

```bash
curl -s "https://treasury-subgraph-api.olympusdao.finance/v2/treasury-assets/daily?start=YYYY-MM-DD&end=YYYY-MM-DD" \
| python3 -c '
import json, sys
from collections import defaultdict
pos = defaultdict(lambda: {"balance": 0.0, "rates": set(), "rows": 0})
for r in json.load(sys.stdin)["data"]:
    k = (r["blockchain"], r["token"], r["tokenAddress"])
    pos[k]["balance"] += r["balance"]; pos[k]["rates"].add(r["rate"]); pos[k]["rows"] += 1
    pos[k]["exOhm"] = pos[k].get("exOhm", 0.0) + r["valueExcludingOhm"]
    pos[k].update(isLiquid=r["isLiquid"], multiplier=r["multiplier"], block=r["block"])
for (chain, tok, addr), p in sorted(pos.items()):
    print(chain, tok, addr, "balance=%.4f" % p["balance"], "mark=%s" % sorted(p["rates"]),
          "valueExcludingOhm=%.2f" % p["exOhm"], "isLiquid=%s" % p["isLiquid"],
          "multiplier=%s" % p["multiplier"], "block=%s" % p["block"])'
```

- **Position** = sum of `balance` across all rows with the same chain, `token` name
  and `tokenAddress`. Group by name too: records that aren't wallet holdings reuse
  the underlying's address. Examples: "DAI - Borrowed Through Cooler Loans
  Clearinghouse V1.1" has DAI's address, and "wETH - Stability Pool" has WETH's.
  Assess those as separate positions.
- **Mark** = `rate`. It is the price the indexer values the asset at, and the
  price every Gate 2 cost is measured against.
- Use the latest **complete** date *for that chain*: its `indexingProgress.date` in
  `GET /v2/bounds` minus one day. Chains index at different speeds, so the global
  `latestDate` can still be filling in for some of them.
- **POL records** have `balance` 1 and a `rate` equal to the whole position including
  OHM. The rubric measures the non-OHM side, which is `valueExcludingOhm`.
- **Exit assets:** ETH/WETH on Ethereum or on a canonical-bridge L2, and the chain's
  main stablecoin in the table below, need no quote for Gates 1 and 2. Assess Gate 3
  only. A token bridged through a third-party bridge (for example Multichain WETH on
  Fantom) is not an exit asset.
- **New asset not yet indexed:** use the intended position size from the PR or
  proposal, and the price the pricing handler you are adding will produce. Say so in the evidence.

## Slices and impact (Gate 2, sale path)

1. `slice = position / 7`.
2. Quote selling one slice into the chain's main stablecoin (see table), so the
   output is already in USD. If the only route is into ETH or the native token,
   convert the output using the indexer's mark for that token.
3. `impact = 1 - quoteOutUsd / (slice * mark)`.
4. Pass when `impact <= 0.05`.
5. Take two quotes a minute or so apart and record both; quotes drift. Don't use a
   full-position quote as evidence: aggregators saturate at large sizes and the
   number is unreliable.
6. Base units: compute with Python `Decimal` (`int(Decimal(str(slice)) * 10**decimals)`),
   not floats. Floats lose precision at 1e24.
7. **Mark drift.** The mark is from the snapshot date and the quote is live. If the
   slice fails only because the market moved (a tiny quote is also more than 5%
   below the mark), re-run against the newest complete date's mark before failing
   it, and note it.

Measure against the **mark**, never the aggregator's own `amountInUsd`. An
aggregator prices a depegged token at its market price, so its "impact" looks
small while the indexer is still marking the token at par.

### Adding CEX depth

CoinGecko reports, per venue, the USD needed to move the price 2%
(`cost_to_move_down_usd`). A 2% move is inside the 5% budget, so:

- `cexDepth` = sum of `cost_to_move_down_usd` over venues with a real order book
  (skip DEX tickers, since aggregators already cover those).
- If `cexDepth >= slice`, the slice passes on CEX alone.
- Tickers don't say whether a venue is a CEX. Look up each
  `t["market"]["identifier"]` with `GET /api/v3/exchanges/<identifier>` and keep
  only those with `"centralized": true`. The tickers endpoint returns up to 100
  tickers per page; use `&page=2` beyond that.
- Otherwise quote the remainder (`slice - cexDepth`) on DEX and apply the 5% test to it.
- CEX depth only counts if the treasury can actually deposit there (Gate 3 custody).
  If that isn't established, leave CEX out.

## Coverage (verified 2026-09-28)

| Chain | Stable to quote into | KyberSwap | ParaSwap | Other | Working public RPC |
|---|---|---|---|---|---|
| Ethereum (1) | USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | yes | yes | | `https://ethereum-rpc.publicnode.com` |
| Arbitrum (42161) | USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | yes | listed, not quote-tested | | `https://arb1.arbitrum.io/rpc` |
| Base (8453) | USDC `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` | yes | listed, not quote-tested | | `https://base-rpc.publicnode.com` (`mainnet.base.org` rate-limits after a few reads) |
| Polygon (137) | USDC `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | yes | listed, not quote-tested | | `https://polygon-bor-rpc.publicnode.com` |
| Fantom (250) | USDC `0x04068da6c83afcfa0e13ba15a6696662335d5b75` | no route | chain not supported | SpookySwap V2 router over RPC (below) | `https://rpcapi.fantom.network` |
| Berachain (80094) | HONEY `0xFCBD14DC51f0A4d49d5E53C2E0950e0bC26d0Dce` | yes | not supported | | `https://rpc.berachain.com` |
| Robinhood (4663) | USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | "token not found" | supported | | `https://rpc.mainnet.chain.robinhood.com` |

Unusable on 2026-09-28: Odos (`api.odos.xyz` returned Cloudflare error 1033 on
every chain) and OpenOcean (Cloudflare challenge page). Several of the indexer's own
default RPCs failed from a plain client (`eth.llamarpc.com`, `rpc.ftm.tools` 401,
`polygon-rpc.com` 403), so use the RPCs in the table.

**Read ParaSwap errors carefully.** Without `maxImpact`, ParaSwap turns any route
with a loss over its default limit into `"error": "ESTIMATED_LOSS_GREATER_THAN_MAX_IMPACT"`.
The same response still contains a `priceRoute`, so that route exists. Always pass
`&maxImpact=100` (the command below does). Only "No routes found with enough
liquidity" means no route.

"No route" from an aggregator that supports the chain is evidence: nobody makes a
market for that pair at that size. ParaSwap returning "No routes found with enough
liquidity" for rUSDG -> USDG on Robinhood is an example. "Chain not supported" and an
API that is down are *not* evidence. Move to the next source.

### Source order

1. Ask **every** aggregator that supports the chain (KyberSwap, ParaSwap).
   - If any returns a route, use the best quote.
   - If they all return "no route", and there's no CEX book, that is proof of no
     market. The sale path fails.
2. If no aggregator supports the chain, or they're all down, use a direct router
   quote over RPC on the chain's main DEX.
3. If nothing can be queried, the sale path is unproven, so the verdict is illiquid
   (provisional).

## Commands

KyberSwap (chain slug: `ethereum`, `arbitrum`, `base`, `polygon`, `berachain`):

```bash
curl -s -H 'x-client-id: olympus-liquidity' \
  "https://aggregator-api.kyberswap.com/<slug>/api/v1/routes?tokenIn=<asset>&tokenOut=<stable>&amountIn=<slice in base units>" \
| python3 -c 'import json,sys; s=json.load(sys.stdin)["data"]["routeSummary"]; print(s["amountOut"], s["amountOutUsd"])'
```

`amountOut` is in the stable's base units (USDC and USDG have 6 decimals, HONEY has 18).

ParaSwap (`network` = chain id):

```bash
curl -s "https://api.paraswap.io/prices?srcToken=<asset>&srcDecimals=<d>&destToken=<stable>&destDecimals=<d>&amount=<slice in base units>&side=SELL&network=<chainId>&version=6.2&maxImpact=100" \
| python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("error") or d["priceRoute"]["destAmount"])'
```

CoinGecko CEX depth (no API key needed). Find the coin id with
`curl -s "https://api.coingecko.com/api/v3/search?query=<name>"`, then:

```bash
curl -s "https://api.coingecko.com/api/v3/coins/<coin-id>/tickers?depth=true" \
| python3 -c '
import json, sys
for t in json.load(sys.stdin)["tickers"]:
    print(t["market"]["identifier"], t["base"], t["target"], t.get("cost_to_move_down_usd"))'
# then, per identifier: curl -s https://api.coingecko.com/api/v3/exchanges/<identifier> -> "centralized"
```

Fantom router quote (SpookySwap V2 `getAmountsOut`). Run from the repo root so
`viem` resolves:

```bash
node --input-type=module -e '
import { createPublicClient, http, parseAbi } from "viem";
const c = createPublicClient({ transport: http("https://rpcapi.fantom.network") });
const out = await c.readContract({
  address: "0xF491e7B69E4244ad4002BC14e878a34207E38c29",
  abi: parseAbi(["function getAmountsOut(uint256,address[]) view returns (uint256[])"]),
  functionName: "getAmountsOut",
  args: [<slice in base units>n, ["<asset>", "0x04068da6c83afcfa0e13ba15a6696662335d5b75"]],
});
console.log(out.at(-1));'
```

## Redemption path (Gates 1 and 2)

- **Cost:** `1 - (underlying received per unit × underlying mark) / mark`. For an
  ERC4626 vault the underlying per unit is `convertToAssets(10**decimals)`; add any
  redemption fee.
- **Capacity:** the vault or pool must be able to pay our full position. Compare our
  size to the vault's underlying balance (`totalAssets()`, or the underlying's
  `balanceOf(vault)`), or for Aave to the pool's available liquidity (underlying
  `balanceOf(aToken)`).
- **Cooldown vaults** (for example sUSDe): `maxWithdraw` / `maxRedeem` can report
  the full balance while a direct `redeem` reverts because a cooldown applies. Read
  the cooldown (`cooldownDuration()`), and prove the cooldown can start by simulating
  it from our wallet: `simulateContract({ account: <treasury wallet>, functionName: "cooldownShares", args: [<balance>] })`.
- **Treasury-internal steps** (a multisig transaction, or a Bophades policy moving
  tokens out of a module) count as immediate unless they need an on-chain
  governance vote.

## LP exit (Gates 1 and 2)

A pro-rata split of the reserves overstates what a burn returns when the pool mints a
protocol fee on burn (Camelot came out 2.3% lower). Simulate the burn instead. For a
UniV2-style pair, `eth_call` `burn(<treasury wallet>)` against the pair, with a state
override that gives the pair its own LP balance. The balances mapping is usually
slot 1; confirm it for each fork. Then measure the non-OHM side as a sale or
redemption.

For a UniV3 NFT position, simulate the exit from the owning wallet:
`simulateContract` on the NonfungiblePositionManager with
`decreaseLiquidity({ tokenId, liquidity: <full>, amount0Min: 0, amount1Min: 0, deadline })`,
then `collect`. Also check that the pool holds enough of the non-OHM token to pay it.
Uncollected fees aren't part of the indexed position, so leave them out of Gate 2;
at most mention them under Mark check.

## Contract state (Gates 1 and 3)

Read lock expiries, cooldowns, queues, and withdrawable amounts on-chain rather than
trusting docs or memory. Docs go stale: the sUSDe cooldown was assumed to be 7 days
but read as 1 day on 2026-09-28. Use the same `viem` pattern:

```bash
node --input-type=module -e '
import { createPublicClient, http, parseAbi } from "viem";
const c = createPublicClient({ transport: http("<rpc from table>") });
console.log(await c.readContract({
  address: "<contract>",
  abi: parseAbi(["function <name>(<args>) view returns (<type>)"]),
  functionName: "<name>",
  args: [],
}));'
```

Useful reads:

| What | Call |
|---|---|
| Ethena sUSDe cooldown | `cooldownDuration() returns (uint24)`, in seconds; simulate `cooldownShares` from our wallet |
| Ethena restrictions on our wallet | `hasRole(keccak256("FULL_RESTRICTED_STAKER_ROLE"), wallet)` and `SOFT_RESTRICTED_STAKER_ROLE` (should be false) |
| USDC pause / blacklist | `paused() returns (bool)`, `isBlacklisted(address) returns (bool)` |
| ERC4626 redemption rate | `convertToAssets(uint256) returns (uint256)` |
| Aave available liquidity | underlying `balanceOf(aTokenAddress)` |
| Staking contract can pay out | simulate `withdraw` / `emergencyWithdraw` from our wallet, and check the staked token's `balanceOf(stakingContract)` |
| Vote-escrow lock end | the protocol's `locked(address)` / `lockedEnd(address)`; check its ABI on the explorer |
| Mellow queue (rUSDG) | the `redeemQueue` contract in `robinhood.ts`; read its delay/claim parameters from the verified ABI |

### Historical reads (effective blocks, reconciling a mark)

The RPCs in the coverage table serve recent state only.
`ethereum-rpc.publicnode.com` refused a block about 29 hours old. For past blocks:

- **Ethereum:** `https://eth.drpc.org` and `https://1rpc.io/eth` answered historical
  reads (verified 2026-09-29).
- **Other chains:** no public archive RPC was verified. The Arbitrum public RPCs
  refuse historical reads. Find the block from event logs on the chain's explorer,
  or mark the effective block TBD and flag it for a human.

### Custody and issuer status (Gate 3)

Use primary sources and record the URL. Examples that worked:

- **Ethena backing:** `https://ethena.fi/api/positions/current/collateral?latest=true`
  (`totalBackingAssetsInUsd`, compare with USDe `totalSupply()`) and
  `https://ethena.fi/api/solvency/reserve-fund`. `status.ethena.fi` and
  `app.ethena.fi/api` did not respond to plain clients.
- **On-chain pause and blacklist flags** (table above).
- **Incident search:** the issuer's announcements, or recent news, to check for any
  depeg, pause, or exploit.

An admin's *ability* to pause, blacklist, or lengthen a cooldown is not a Gate 3 fail.
Gate 3 fails on an actual impairment, an active block or delay against us, or an
announced change that would push the exit past 7 days.
