---
name: asset-liquidity
description: Use when adding or changing a TokenDefinition, isLiquid, multiplier, or illiquidWallets in apps/indexer/src/snapshot/chains/*.ts or in a handler that overrides them, when asked whether a treasury asset should count as liquid or illiquid (liquid backing), or when asked to audit the treasury's liquidity classifications.
---

# Asset liquidity

## Overview

`docs/asset-liquidity-rubric.md` defines what "liquid" means in this indexer. **Read it
before assessing anything.** It holds the three gates, the burden of proof, the
standing rules, and the only allowed exceptions. This skill is the procedure for
applying it. `references/measuring.md` is how to get each number.

The verdict is binary. There are no degrees of liquidity and no invented cutoffs.

## Gate mode: assess one asset

1. **Identify the asset.** The unit is a **record**: one token name and address as
   the metrics API shows it. Records can share a definition but exit differently.
   For example, "JONES - Staked" inherits the JONES definition but can only leave
   through the staking contract.
   - chain and address
   - type: plain token, wrapper, LST, vault share, lending receipt, lock/escrow, LP,
     staked LP, receivable, or liability
   - its underlying
   - every third party between the treasury and the underlying
   - where its classification lives: the definition, a handler override
     (`record.isLiquid` / `record.multiplier`), or `illiquidWallets` (per wallet)
2. **Check standing rules and exceptions first.**
   - OHM/gOHM are out of scope.
   - A liability is liquid.
   - An asset named in the rubric's Exceptions takes its listed verdict.

   If one applies, stop and output with the rule or exception as the reason.
3. **Get size and mark** using `references/measuring.md`.
4. **List every exit path that exists.** Test Gate 1 and Gate 2 on each path. The
   asset passes only if **one path passes both**. If several paths pass, the comment
   reports the cheapest one.
5. **Test Gate 3** on the path that passed. If no path passed, Gate 3 is
   `n/a (no passing path)`.
6. **Fill in every slot** of the output template. Dates are the UTC date of the evidence.

## Audit mode: all assets

1. **Inventory**
   - **Held records:** the position script in `references/measuring.md`, run for the
     latest complete date for that chain (its `indexingProgress.date` in
     `/v2/bounds`, minus one day). This is the list you score.
   - **Definitions:** `grep -n "isLiquid" apps/indexer/src/snapshot/chains/*.ts`
   - **Overrides:** `grep -rn "record\.isLiquid\|record\.multiplier\|illiquidWallets" apps/indexer/src`
   - **Definitions that never match a record.** A definition is looked up by the
     record's `tokenAddress`. One keyed by anything else (a 32-byte pool id, or an
     address no handler emits) is inert, and the held asset falls back to the
     liquid default in `records.ts`.
2. **Score each held record** with gate mode. Records with the same underlying and
   the same exit path are scored once. Definitions with no position are listed
   once, as a group ("not held, not assessed"), along with out-of-scope OHM/gOHM
   definitions. They are assessed when a position appears.
3. **Report**
   - One row per issue; an asset can have several rows.
   - Columns: asset | chain | class | current | rubric | liquid-backing effect ($) |
     action. The effect is how much liquid backing moves if the action is applied (0
     when nothing moves).
   - After the table, give the gate-mode output for each held record.
   - Sort by class, then by effect. The classes:
     1. current classification disagrees with the rubric
     2. liquidity-haircut multiplier to retire
     3. flag that has no effect, or a definition that never matches a record
     4. held record with no definition
   - Missing or stale `// liquidity:` comments: one summary line with a count, not
     one row each.
   - Then "Other findings": mark problems and indexer bugs you came across, each
     with its evidence.
4. **Report only.** Do not edit files. Each fix is its own change and goes through
   gate mode.

A full audit is about 150-250 tool calls. Run one subagent per chain, and split
Ethereum by category (stables and vaults, lending, locks, POL).

## Output template (every slot required)

```
Verdict: liquid | illiquid | illiquid (provisional) | liquid (exception: <name>) | liquid (liability) | out of scope
Comment: <one of the comment forms below>
Multiplier: <value> (unchanged | retire <old> -> 1: liquidity haircut | mechanical: POL non-OHM share | mechanical: OHM exclusion | mechanical: existing write-off)
Evidence: | gate | path | number | source (URL, command, or "stated fact") | UTC timestamp or date |
Change: none | none (comment only) | isLiquid <old> -> <new> and/or multiplier <old> -> <new>, effective block <n> | "TBD: first block after <event>" | "startBlock (no triggering event)"; history: neither field is block-aware yet, so a reindex rewrites history. Say so in the PR.
Needs human: no | yes: <unproven gate, TBD effective block, or the requester disputes the verdict>
Mark check: ok | n/a (no mark needed) | mark <x> vs realizable <y or "none">: pricing issue, separate change
```

Comment vocabulary:
- **Path labels:** `hold` (the asset is already an exit asset), `redeem`, `unlock`,
  `withdraw`, `DEX`, `CEX`, `LP exit`.
- **G3 values:** `pass`, `fail`, `unproven`, `n/a` (no third party), `n/a (no passing path)`.
- **Slice:** sale paths only. Always `slice $<position × mark / 7>`, never the full
  position.

Comment forms:

```ts
// passing path
// liquidity: liquid. G1 pass: DEX, 7 daily slices. G2 pass: 1.8% per slice $1.2M. G3 pass: Ethena normal, USDC normal. (assessed 2026-09-28)
// liquidity: liquid. G1 pass: redeem, 1-day cooldown. G2 pass: 0% at vault rate, vault holds $1.3B vs our $29M. G3 pass: Ethena normal. (assessed 2026-09-29)
// no passing path: one clause per existing path, naming the gate it fails
// liquidity: illiquid. redeem: G1 fail (14-day queue). DEX: G2 fail (8% per slice $857K). G3 n/a (no passing path). (assessed 2026-09-28)
// exit asset (ETH/WETH via a canonical bridge, the chain's main stablecoin)
// liquidity: liquid. G1 pass: hold, exit asset. G2 pass: hold, 0%. G3 pass: Circle USDC normal. (assessed 2026-09-29)
// could not measure
// liquidity: illiquid (provisional). DEX: G2 unproven (no aggregator covers chain). G3 n/a (no passing path). (assessed 2026-09-28)
// exception / liability / out of scope
// liquidity: liquid. EXCEPTION: Cooler Loans receivables, see docs/asset-liquidity-rubric.md#exceptions. (assessed 2026-09-28)
// liquidity: liquid. LIABILITY: always liquid, see docs/asset-liquidity-rubric.md#standing-rules. (assessed 2026-09-28)
// liquidity: out of scope. OHM/gOHM never count toward liquid backing. (assessed 2026-09-28)
```

## Multiplier rules

A multiplier is only one of three things:
- the POL non-OHM share (computed);
- 0 on an OHM/gOHM definition (OHM exclusion; keep it); or
- a write-off to 0.

Multipliers never change market value. They only scale liquid backing
(`valueExcludingOhm`).

**Never set `multiplier = 1 - discount`.** Slippage within 5% passes Gate 2 at a
multiplier of 1. Slippage above 5% fails Gate 2: the asset is illiquid, not
"liquid at 0.9". An existing haircut (for example 0.77 "because it's thin") is
retired to 1, or the asset becomes illiquid.

## Red flags: stop and re-read the rubric

| Thought | Reality |
|---|---|
| "Liquid at 0.92 to reflect the 8% slippage" | Haircuts are retired. Over 5% is illiquid. |
| "I'll use a 10% cutoff" / "my own threshold" | The thresholds are 7 days and 5%, from the rubric. |
| "The fast path passes Gate 1 and the cheap path passes Gate 2" | Both gates must pass on the same path. |
| "No data, but it's probably fine" / "keep the current flag" | Unproven is illiquid (provisional), flagged for a human. |
| "It's just like Cooler, same reasoning" | Exceptions cover only the asset they name. New ones need a rubric PR. |
| "The 0.89 does nothing, leave it" | Flag it for retirement anyway. |
| "The mark is wrong, so I'll adjust the multiplier" / "write it off" | A multiplier can't fix a mark, and write-offs are the team's call. Report it under Mark check. |
| "No route found, so the data is missing" | "No route" from every aggregator that supports the chain is proof of no market (illiquid). Provisional is only for data that couldn't be obtained. |
| "The aggregator returned an error, so there's no route" | Read the error. A max-impact error still carries a route (see measuring.md). |
| "It inherits a liquid definition, so it's liquid" | Assess the record's own exit path. |
| "It's urgent, skip the measurement" | Urgency doesn't change the evidence needed. |

## What this skill does not do

- Edit code. The author applies the output.
- Grant or extend exceptions.
- Change history. It proposes an effective block.
- Fix prices.
