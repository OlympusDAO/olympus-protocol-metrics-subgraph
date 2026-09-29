---
name: asset-liquidity
description: Use when adding or changing a TokenDefinition, isLiquid, or multiplier in apps/indexer/src/snapshot/chains/*.ts or in a handler that overrides them, when asked whether a treasury asset should count as liquid or illiquid (liquid backing), or when asked to audit the treasury's liquidity classifications.
---

# Asset liquidity

## Overview

`docs/asset-liquidity-rubric.md` defines what "liquid" means in this indexer. **Read it
before assessing anything.** It holds the three gates, the burden of proof, the
standing rules, and the only allowed exceptions. This skill is the procedure for
applying it.

The verdict is binary. There are no degrees of liquidity and no invented cutoffs.

## Gate mode: assess one asset

1. **Identify the asset.**
   - chain and address
   - type: plain token, wrapper, LST, vault share, lending receipt, lock/escrow, LP,
     staked LP, receivable, or liability
   - its underlying
   - every third party between the treasury and the underlying
2. **Check standing rules and exceptions first.**
   - OHM/gOHM are out of scope.
   - A liability is liquid.
   - An asset named in the rubric's Exceptions takes its listed verdict.

   If one applies, stop and output with the exception or rule as the reason.
3. **Get size and mark** using `references/measuring.md`.
4. **List every exit path.** Test Gate 1 and Gate 2 on each path. The asset passes
   only if **one path passes both**.
5. **Test Gate 3.**
6. **Fill in every slot** of the output template.

## Audit mode: all assets

1. **Inventory:**
   - `grep -n "isLiquid\|multiplier" apps/indexer/src/snapshot/chains/*.ts`
   - `grep -rn "isLiquid =\|multiplier =" apps/indexer/src/handlers/`
   - the tokens held on the latest date, from the position script in
     `references/measuring.md`. Any held token without a definition defaults to
     liquid (`records.ts`).
2. **Score** each asset with gate mode. Assets with the same underlying and the same
   exit path are scored once.
3. **Report** one table with columns: asset | chain | current flag | rubric verdict |
   failing gate | action. Sort rows by severity:
   1. flag disagrees with the rubric
   2. missing or stale `// liquidity:` comment
   3. liquidity-haircut multiplier to retire
   4. flag with no effect (for example POL wrappers)
   5. held token with no definition
4. **Report only.** Do not edit files. Each fix is its own change and goes through
   gate mode.

## Output template (every slot required)

```
Verdict: liquid | illiquid | illiquid (provisional) | liquid (exception: <name>) | liquid (liability)
Comment: // liquidity: <verdict>. G1 <pass|fail|unproven>: <path, time>. G2 <pass|fail|unproven|n/a>: <impact vs mark, slice size>. G3 <pass|fail|n/a>: <party, state>. (assessed YYYY-MM-DD)
Multiplier: <value> (<"unchanged" | "retire <old> -> 1: liquidity haircut" | "mechanical: POL non-OHM share / write-off">)
Evidence: | gate | path | number | source (URL or command) | UTC timestamp |
Flip: <"none" | "<old> -> <new>, effective block <n> (<event>); history: flag is not block-aware yet, so reindex rewrites history before block <n>. Say so in the PR">
Needs human: <"no" | what is unproven or disputed>
Mark check: <"ok" | "mark <x> vs realizable <y>: pricing issue, separate change">
```

Exception verdicts use this comment form:
`// liquidity: liquid. EXCEPTION: <name>, see docs/asset-liquidity-rubric.md#exceptions. (assessed YYYY-MM-DD)`

## Multiplier rules

A multiplier is only one of two things:
- the POL non-OHM share (computed); or
- a write-off to 0.

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
| "The mark is wrong, so I'll adjust the multiplier" | A multiplier can't fix a mark. Report it under Mark check. |
| "It's urgent, skip the measurement" | Urgency doesn't change the evidence needed. |

## What this skill does not do

- Edit code. The author applies the output.
- Grant or extend exceptions.
- Change history. It proposes an effective block.
- Fix prices.
