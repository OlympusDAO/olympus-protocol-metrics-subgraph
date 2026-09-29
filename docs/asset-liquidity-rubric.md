# Asset liquidity rubric

This is the definition of which treasury assets are **liquid** in the metrics indexer.
Every `TokenDefinition` (and every handler that sets `isLiquid` or `multiplier`) is
classified against it. The `asset-liquidity` skill (`.agents/skills/asset-liquidity/`)
applies this rubric; it does not change it. To change the rubric, change this file in a PR.

## What "liquid" means here

An asset is liquid when it counts toward **liquid backing**: the protocol could turn it
into usable reserves within a week without a material loss.

The flag has one effect (`apps/indexer/src/snapshot/global.ts`, `computePerChainAggregate`):

- Liquid and illiquid assets both count at full value in treasury **market value**.
- Only liquid assets count toward treasury **liquid backing**, and through it the
  liquid backing per OHM floating, per OHM backed, and per gOHM backed.

It is all-or-nothing: an illiquid asset contributes nothing to liquid backing, so a
multiplier on an illiquid asset has no effect on these metrics.

The multiplier scales `valueExcludingOhm`, which only feeds liquid backing. **It
never changes market value**, which sums `value` (balance × mark).

A record's classification can come from three places, and each one follows this rubric:

- **The token definition** (`isLiquid`, `multiplier` in `apps/indexer/src/snapshot/chains/*.ts`).
  Applies to every record of that token unless something below overrides it.
- **A handler override** (`record.isLiquid` / `record.multiplier` in
  `apps/indexer/src/handlers/`). Use it for a record that exits differently from its
  token. For example, staked MAGIC in the Atlas Mine is locked while MAGIC itself is not.
- **`illiquidWallets`** in a chain config. Marks everything a wallet holds as
  illiquid. This is Gate 3 applied per wallet: for example, assets at a custodian
  the treasury can't deploy from.

## The gates

An asset is **liquid only if it passes all three gates**. Failing any one makes it
illiquid.

Every gate is judged on:

- the treasury's **full position** in the asset: the current balance across all
  treasury wallets, or the intended size for a new asset; and
- the **mark**: the price the indexer values the asset at.

### Gate 1: exit within 7 days

At least one exit path turns the full position into stablecoins or ETH within 7 days of
deciding to exit.

"Stablecoins" means Stable-category tokens that are themselves liquid under this
rubric (for example USDC, DAI, USDS, USDe, HONEY, USDG). "ETH" includes WETH, and ETH
on an L2 reached through that chain's canonical bridge. It does not include ETH
bridged through a third-party bridge.

Steps inside the treasury (a multisig transaction, or a Bophades policy moving
tokens out of a module) count as immediate unless they need an on-chain governance
vote.

Exit paths:

- protocol redemption, unlock, or withdrawal, including cooldowns and withdrawal queues;
- selling on a DEX or CEX;
- for LP and staked LP positions: unstake, remove liquidity, then redeem or sell the
  non-OHM side. The position and Gate 2 are measured on the non-OHM side only, because
  that is all the POL multiplier counts.

An asset with no market and no redemption (for example a one-way wrapper that no
aggregator routes) fails **Gate 1**: it has no path at all.

A 7-day wait passes. More than 7 days fails. A sale in 7 daily slices (days 1-7)
fits the window.

The gate fails when every path takes longer than 7 days. Typical examples:

- vote-escrowed or time-locked positions (ve-tokens, vote-locked tokens);
- non-transferable tokens that cannot be redeemed in time;
- one-way wrappers with no market.

### Gate 2: exit cost at most 5%

**The same path** that passed Gate 1 recovers at least 95% of the mark.

- **Sale path:** split the full position into 7 equal daily slices. Each slice must be
  sellable within 5% of the mark, across all venues combined.
- **Redemption path:** fees plus any redemption discount count as cost. The pool or
  vault must also have enough available liquidity to pay out our size (for example Aave
  available liquidity, or an ERC4626 vault's `maxWithdraw`).

Measure against the mark, not against the market price. A depegged asset that the
indexer still marks at par fails, which is the point: liquid backing must not count
value we cannot get out.

Gates 1 and 2 must be passed by the same path. A fast exit that loses 8% and a
lossless exit that takes 14 days are two failing paths, not one passing asset.

### Gate 3: no blocked or impaired custodian

This gate applies to the path that passed Gates 1 and 2. It covers any third party
whose failure would break that path: a bridge, custodian, CEX, RWA issuer, lending
pool, LST or wrapper protocol, or the issuer of the stablecoin the path ends in.

It fails if that party:

- is impaired: collapsed, frozen, paused, or holding backing that no longer covers the
  asset; or
- can currently block or delay our exit beyond 7 days.

A party passes when its part of the exit is working as stated (a live quote, normal
withdrawals) and there is no known impairment. Mark it unproven only when there's a
specific reason for doubt (a pause, depeg, incident, or announcement) that can't be
resolved.

An admin's *ability* to pause, blacklist, or lengthen a cooldown doesn't fail the
gate. Nearly every issuer has one. The gate fails on an actual impairment, an active
block or delay against the treasury, or an announced change that would push the exit
past 7 days. The gate is n/a when the path
depends on no third party, and when no path passed Gates 1 and 2 (the asset is
already illiquid).

## Burden of proof

A gate that cannot be shown to pass is a **fail**. Two cases differ:

- **Measured and absent.** Every source that covers the chain was asked and found no
  market: every supporting aggregator returned no route, and there is no CEX order
  book. That is evidence there is no market. The gate fails and the verdict is
  **illiquid**.
- **Could not measure.** No source covers the chain, the sources were down, the
  contract could not be read, or a fact (lock length, custodian status) could not
  be established. The gate is unproven, the verdict is **illiquid (provisional)**,
  and a human reviews it.

Counting an asset as liquid needs evidence. Counting it as illiquid does not.

## Standing rules

- **OHM and gOHM** are out of scope. They never count toward liquid backing. Two
  mechanisms enforce that:
  - `global.ts` skips `OHM`-category records.
  - OHM/gOHM token definitions (category `Volatile`) carry `multiplier: "0"`, and
    `treasuryBlacklist` keeps treasury-held OHM out of the records.

  Don't remove either one.
- **Liabilities** (`isLiability: true`, such as Aave variable debt) are always liquid, so
  they always reduce liquid backing.
- **Multipliers** are only for mechanical value adjustments:
  - the non-OHM share of a POL position;
  - 0 on OHM/gOHM definitions (the exclusion above);
  - a write-off to 0.

  A multiplier is never a discount for "hard to sell". A hard-to-sell asset passes
  Gate 2 at a multiplier of 1, or it is illiquid.

  Deciding to write an asset off is an accounting call for the team. The skill
  never proposes one. A mark that overstates what the asset can be sold for is a
  pricing bug and is reported separately.
- **A rationale comment sits wherever a classification is set:** the definition of
  every held asset, every handler override, and every `illiquidWallets` entry. The
  skill defines the full set of comment forms. Two examples:

  ```ts
  // liquidity: illiquid. unlock: G1 fail (locked until 2027-02-01). DEX: G1 fail (non-transferable). G3 n/a (no passing path). (assessed 2026-09-28)
  // liquidity: liquid. G1 pass: DEX, 7 daily slices. G2 pass: 1.8% per slice $1.2M. G3 pass: USDC normal. (assessed 2026-09-28)
  ```

  A definition with no position needs no comment until the treasury holds it.

- **History:** a reclassification takes effect from the block where the facts changed
  (a lock started, a bridge collapsed, a peg broke). Earlier history keeps the old
  classification.

  When nothing changed in the world (a new asset, retiring a haircut, or correcting a
  classification that was wrong from the start), the effective block is the
  definition's `startBlock`.

  The indexer cannot yet vary `isLiquid` or `multiplier` by block. Until it can,
  changing either rewrites all history on the next reindex, and the PR must say so.

## Exceptions

An exception classifies an asset against the gates on purpose. Each one is listed here
with its reasoning. Nothing else overrides the gates.

To add an exception, open a PR against this section explaining why the gates give the
wrong answer for that asset. "It is similar to an existing exception" is not a reason:
each exception covers only the asset it names.

### Cooler Loans receivables: liquid

This covers DAI and USDS lent through the Cooler Loans clearinghouses (V1, V1.1, V2,
and MonoCooler), recorded as "DAI/USDS - Borrowed Through Cooler Loans ...".

Loans have fixed terms, so a strict reading of Gate 1 fails. They count as liquid
because:

1. every loan is over-collateralized by gOHM;
2. a default returns that collateral to the treasury, and the collateral is itself
   treasury backing; and
3. legacy parity: the legacy subgraph counted these receivables as liquid
   (`CoolerLoansClearinghouse.ts`, "Considers DAI receivables as liquid").

Size, for context: about $132M on 2026-09-27, the largest single component of liquid
backing.

## Worked examples

These are expected results from applying the rubric to the assets tracked on
2026-09-28. They are predictions until an audit measures them. Assets marked
"measure" depend on market depth.

| Asset | Chain | Today | Rubric | Notes |
|---|---|---|---|---|
| USDC, USDT, DAI, USDS, LUSD, FRAX, HONEY, USDG | all | liquid | liquid | G3 pass for healthy issuers |
| ETH, WETH, BERA, wBERA | all | liquid | liquid | |
| wstETH, weETH | Ethereum | liquid | liquid | deep DEX exit; withdrawal queues don't matter |
| sUSDe | Ethereum | liquid | measure | cooldown read on-chain as 1 day; at ~23.5M sUSDe, each 1/7 slice is ~$4.2M |
| sUSDS, Gauntlet sUSDS vault | Ethereum | liquid | liquid if `maxWithdraw` covers our size | |
| Aave receipts (aDAI, aEthUSDe, aEthSUSDe) | Ethereum | liquid | liquid if pool liquidity covers our size | |
| Aave variable debt | Ethereum | liquid | liquid | liability rule |
| Cooler Loans receivables | Ethereum | liquid | liquid | exception |
| veFXS, veMAGIC, rlBTRFLY | Ethereum, Arbitrum | illiquid | illiquid | G1 fail; rlBTRFLY's 0.89 multiplier to be retired |
| ENA, sENA | Ethereum | illiquid | needs a reason | added 2026-09-25 as illiquid with no recorded rationale; ENA trades deep, so without a lock or vesting it would pass |
| rUSDG (Mellow vault) | Robinhood | illiquid | depends on queue length | no secondary market (no ParaSwap route); liquid only if the redeem queue settles within 7 days |
| iBERA, iBGT, lBGT | Berachain | illiquid | measure | iBGT/lBGT are one-way wrappers, so only the sale path counts |
| JONES, VSTA, KLIMA, sKLIMA | Arbitrum, Polygon | liquid with haircut | measure; multiplier 1 either way | haircuts retired |
| JONES - Staked | Arbitrum | liquid (inherited), multiplier 0 | illiquid | audit 2026-09-29: `withdraw` and `emergencyWithdraw` revert and the staking contract holds 0 JONES (G1). The write-off to 0 is mechanical and stays; liquid backing is unaffected |
| BitGo custody wallets (`illiquidWallets`) | Berachain | illiquid | illiquid | G3 per wallet: the treasury can't deploy from them |
| Balancer LP definitions keyed by pool id | Arbitrum | liquid | flag has no effect | keyed by the 32-byte pool id, but records carry the LP address, so a held position would fall back to the liquid default |
| Multichain-bridged DAI, FRAX, USDC, WETH | Fantom | liquid | illiquid from the July 2023 collapse | bridge frozen (redeem fails G1), DEX far below the mark (G2); Fantom wETH is already marked ~$229 against ~$2,690 ETH |
| DEI | Fantom | liquid | illiquid | G2 fail (depegged against a par mark) |
| UniV3 and staked Kodiak/Beradrome POL | Ethereum, Base, Berachain | liquid | liquid if the non-OHM side exits | computed non-OHM multiplier stays |
| Convex/Aura staked LP wrappers | Ethereum | illiquid (flag unused) | measure | POL wrappers never reach the Stable/Volatile record path, so the flag has no effect today |

## Changing this rubric

- Change this file in a PR, and state which assets the change reclassifies.
- After it merges, run the skill's audit mode and turn every flip it reports into its
  own change.
