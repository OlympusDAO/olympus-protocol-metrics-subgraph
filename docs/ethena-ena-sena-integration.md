# ENA and sENA Treasury Coverage

## Scope and accounting

Register Ethereum ENA and sENA across the existing protocol wallet inventory.
Both are `Volatile`, `isLiquid: false` and `isBluechip: false`. The non-liquid
classification is the requested Olympus treasury accounting policy, including
for freely transferable ENA. Positive balances appear in token records and
contribute to treasury market value, but not liquid backing. Zero balances
retain the existing behavior of not producing a holding row.

- ENA value = wallet ENA balance × ENA/USD price.
- sENA value = wallet shares × `convertToAssets(1e18) / 1e18` × ENA/USD price.
- ENA/USD uses the Uniswap V3 0.3% ENA/WETH pool and the existing WETH/USD
  Chainlink route. ENA/WETH uses a one-hour geometric TWAP, not pool spot.
- Underlying ENA inside sENA is not counted as a separate treasury asset.
- The price pool is not registered as a treasury-owned position.

The existing ERC4626 pricing handler reads the conversion at the snapshot
block. Both tokens use `TreasuryERC20.Transfer` only. The verified sENA
implementation inherits OpenZeppelin ERC4626/ERC20 mint/burn behavior, so adding
Deposit/Withdraw ledger subscriptions would double count its share mutations.

This change covers held ENA and sENA, not rsENA, unclaimed rewards or ENA claims
in the sENA cooldown silo. `cooldowns(wallet).underlyingAmount` was zero for both
wallets checked below. A future cooldown burns shares before ENA arrives in the
wallet; separate claim accounting is needed to cover that interval. Do not
interpret this PR as complete cooldown-claim coverage.

## Contract provenance and start blocks

Ethena's official [key addresses](https://docs.ethena.fi/technical-design/key-addresses)
identify both Ethereum contracts. Their metadata and sENA underlying were
corroborated using block-pinned RPC reads.

| Role | Address | Creation Block |
| --- | --- | --- |
| ENA, 18 decimals | `0x57e114b691db790c35207b2e685d4a43181e6061` | 19,371,662 |
| sENA, 18 decimals | `0x8be3460a480c80728a8c4d7a5d5303c85ba7b3b9` | 20,713,442 |
| Uniswap V3 ENA/WETH, fee 3000 | `0xc3db44adc1fcdfd5671f555236eae49f4a8eea18` | 19,567,223 |

Creation transactions:

- [ENA](https://etherscan.io/tx/0x143955622501605a763c6f373edef7c4a9139efffbbecb82d1833324dd558be1)
- [sENA proxy](https://etherscan.io/tx/0x7f6b80f4dd95b4819dedf8750f012aebb18b663b7966866f867295cc6927c3b7)
- [Price pool](https://etherscan.io/tx/0x0fee866ab1fccd8985712f397ab6b9af7bf06ca93d6a9380ffc8eff72766d2ba)

The Uniswap V3 factory `0x1f98431c8ad98523631ae4a59f267346ea31f984`
returned this pool for ENA/WETH and fee 3000. Token0/token1 were verified.
At the observation block it held 2,470,572.131936386328392451 ENA and
351.067464160132271493 WETH, with more active liquidity than the other checked
ENA/WETH fee tiers. The checked ENA/USDT pools had zero active liquidity.

The sENA proxy's verified implementation at observation was
[`0x7fd57b46ae1a7b14f6940508381877ee03e1018b`](https://eth.blockscout.com/address/0x7fd57b46ae1a7b14f6940508381877ee03e1018b?tab=contract).
It exposes `asset`, `convertToAssets`, `cooldowns` and standard ERC4626 methods.

## Block-pinned holding evidence

PublicNode Ethereum RPC, block **26,056,046**, timestamp **1,790,358,395**,
hash `0x44fabbaa014a702f2980e2520b79ce44b889bd1691d2d21dbb9ff776f230bb0c`:

| Existing Treasury Wallet | ENA | sENA | Pending Cooldown ENA |
| --- | --- | --- | --- |
| TRSRY `0xa8687a15d4be32cc8f0a8a7b9704a4c3993d9613` | 0 | 26,440.16 | 0 |
| Treasury MS `0x245cc372c84b3645bf0ffe6538620b04a217988b` | 0 | 15,094.03 | 0 |

`asset()` returned ENA. `convertToAssets(1e18)` returned
`1018269352422694832`, or **1.018269352422694832 ENA per sENA**.
Pool `slot0.sqrtPriceX96` was `780550399454001161472712967`.
These are dated fixtures, not permanently current balances or exchange rates.
The regression test combines these balances/conversion with the later TWAP
fixture below and a controlled $2,400 ETH price. It is a mixed-block unit
fixture, not a claimed historical USD valuation.

Explorer transfer history identified the existing holdings:

- TRSRY: block **25,042,334**, [transfer](https://etherscan.io/tx/0x98e908b0b7f91517c4cc56228cd9abcbe84d1454e700076cee84b64d32f2073f).
- Treasury MS: block **25,052,168**, [transfer](https://etherscan.io/tx/0x7b1e5f0c8fc9f49fbae756e543f3186ec1e13ed662911ba2212c9552fe889277).

Creation/acquisition history above is explorer transaction evidence, not an
archive-state replay. PublicNode rejected old `eth_getCode` calls because archive
access requires a personal token; the public dRPC fallback timed out. Historical
pre/post-deployment RPC replay remains unverified. Current block-pinned reads
must not be represented as proof of historical archive availability.

## Oracle preference and TWAP fallback

Prefer a verified Chainlink ENA/USD feed when one exists on Ethereum with the
required history and freshness semantics. On 2026-09-25, the Chainlink
[Ethereum directory](https://reference-data-directory.vercel.app/feeds-mainnet.json)
contained no ENA listing. At block **26,056,846**, the Ethereum Feed Registry
`0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf` returned `Feed not found` for
`getFeed(ENA, 0x0000000000000000000000000000000000000348)` (USD).
This does not prove no custom feed exists; no suitable Ethereum feed was verified.
The separately listed Plasma feed is not an Ethereum historical-price replacement.

Fallback parameters are explicit reviewable defaults, not empirically proven
optimal thresholds: `observe([3600, 0])`, negative mean ticks rounded down as in
Uniswap OracleLibrary, and a maximum **10% spot/TWAP price-ratio deviation**.
Both observation and slot reads are pinned to the snapshot block and cached by
chain/pool/block/window. Require a valid tick and positive cumulative liquidity
delta. A full-hour observation must succeed; never shorten the window or
silently substitute spot. The pool prices ENA only, not WETH. sENA retains its
independent ERC4626 conversion.

PublicNode read at block **26,056,846**, timestamp **1,790,368,019**, hash
`0xd44a439b6801c98e9892828a71c8271acb0bf695fff01341e16493cf159b89fc`:

- Tick cumulatives: `[-7116251905332, -7116584635080]`.
- Mean tick: `-92425` after flooring.
- Seconds-per-liquidity cumulative delta: `20249843485504294934`.
- `slot0.sqrtPriceX96`: `783082933127646025307382464`.
- Observation cardinality: 600. This current observation is not archive replay proof.

TWAP reduces instantaneous manipulation exposure but does not eliminate sustained
manipulation or thin-liquidity risk. The deviation guard can also trip during a
legitimate fast market or be used to interrupt publication. Invalid observations,
excessive deviation and RPC errors fail the snapshot for a held position instead
of publishing spot or silently dropping its value. Standard token pricing is
lazy: zero holdings do not require an oracle read, allowing pre-acquisition replay
without demanding observations for assets the treasury did not hold. A failed
snapshot requires investigation and rerun before republishing; keep the previous
accepted published artifact until a complete replacement is verified. Historical
TWAP reads at acquisition remain unverified because the public archive rejected
the call. Maintainers must validate these parameters and historical coverage
before deployment. No spot fallback is configured for ENA.

## Integration and deployment

Ethereum's existing chain start is block 12,000,000, before the new contract
starts. No wallet registration, OHM supply exclusions, schema, publisher date
rules or frontend changes are needed. The configured pool events feed the
existing pricing state; ERC20 transfers feed the existing token balance ledger;
`pushTokenBalanceRecords` emits the classified records; existing chain/global
aggregation and published treasury assets retain their value and liquidity flag.

Deploying config alone onto already-advanced balance state is insufficient.
Proposed rollout: maintainers reindex Ethereum from its existing configured
start block 12,000,000 with the new token/pool registrations, then regenerate
the affected Ethereum snapshots and republish cross-chain aggregates. This is
a historical coverage backfill, not a prospective deployment-day classification
change. The replay must include both acquisition transfers. A narrower replay
requires a separately verified state baseline and is not asserted here. Check:

1. Accepted deployment SHA and Ethereum progress past the acquisition blocks.
2. Exactly one sENA record per holding wallet with correct conversion and
   `isLiquid: false`; ENA rows when positive balances exist.
3. ENA/sENA value included once in chain/global market value, and zero added
   to liquid backing from these records.
4. Published API rows and frontend visibility. A frontend that independently
   filters non-liquid assets may need its own follow-up; this PR changes indexing.
5. Historical conversion and full-hour TWAP reads succeed through the deployment's archive RPC; reconcile any failed snapshots before republishing.

The owning indexer package is bumped to v0.3.0 with a September 2026 changelog
entry. No dependency, schema or published client API version changes are included.
