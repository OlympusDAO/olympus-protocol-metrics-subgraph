# Olympus Protocol Metrics Subgraph

Gathers data from bonds, liquidity and Olympus treasury.

Used in the [Olympus Treasury Dashboard](https://app.olympusdao.finance/).

Deployed at:

- [Ethereum mainnet](https://thegraph.com/explorer/subgraphs/7jeChfyUTWRyp2JxPGuuzxvGt3fDKMkC9rLjm7sfLcNp?view=Overview&chain=arbitrum-one)
- [Polygon](https://thegraph.com/explorer/subgraphs/aF7zBXagiSjwwM1yAUiyrWFJDhh5RLpVn2nuvVbKwDw?view=Overview&chain=arbitrum-one)
- [Arbitrum](https://thegraph.com/explorer/subgraphs/8Zxb1kVv9ZBChHXEPSgtC5u5gjCijMn5k8ErpzRYWNgH?view=Overview&chain=arbitrum-one)
- [Fantom](https://thegraph.com/hosted-service/subgraph/olympusdao/protocol-metrics-polygon)
- TODO: [Base]()

## Initial Setup

Run `yarn`

## Writing AssemblyScript

Note that the Graph Protocol compiles from AssemblyScript to WASM. AssemblyScript is strongly-typed, and is similar to TypeScript. However, there are a number of expected features of TypeScript (e.g. try/catch) that aren't implemented in AssemblyScript. A few suggestions:

- Utilise the linting that has been set up in this repository
- Build frequently (`yarn subgraph build <subgraph>`), as linting does not pick up all problems
- Variables that are nullable need to be typed accordingly
- You may run into a TS2322 compiler error when handling null values. The workaround for this is to use the strict equality operator (`===`), instead of loose equality (`==`) or negation (`!someValue`). e.g. `if (someValue === null)`. This is due to a [limitation in the AssemblyScript compiler.](https://github.com/AssemblyScript/assemblyscript/issues/2223#issuecomment-1069245834)
- The Graph Protocol Discord is very helpful to get support. See the `subgraph-development` channel.

## CLI

A CLI tool is available at `yarn subgraph` to make common tasks (building, testing, deploying) significantly easier. Run `yarn subgraph --help` for details of the commands.

Please note that `<subgraph>` is an argument for most of the commands, as files and configuration are stored on a per-subgraph basis.

## Support for Networks

Assets on different networks/chains are supported.

Each network has an independent subgraph, as required by the Graph Protocol. For this reason, each network has an independent file structure under `subgraphs/`.

### Adding a New Subgraph

1. Decide on the name for the subgraph, which will be used throughout. e.g. `arbitrum`
1. Create the following files and folders in `subgraphs/<subgraph>/`: `src/`, `tests/`, `config.json` and `subgraph.yaml`. See [subgraphs/ethereum/](subgraphs/ethereum/) for an example.
1. Create the subgraph through the Graph Protocol (see [Deployment](#deployment) section)
1. Create `bin/subgraph/src/subgraphs/<subgraph>/index.ts` and implement a class that extends `BaseNetworkHandler`. This file defines how a particular subgraph will be automatically tested using the workflow defined in [.github/workflows/query.yml](.github/workflows/query.yml). See [bin/subgraph/src/subgraphs/ethereum/index.ts](bin/subgraph/src/subgraphs/ethereum/index.ts) for an example.
1. Add `<subgraph>` to the matrix strategies defined in [.github/workflows/query.yml](.github/workflows/query.yml) and [.github/workflows/main.yml](.github/workflows/main.yml).

### Triggers

Each subgraph has a different trigger, specified in the respective `subgraph.yaml` file:

- Arbitrum: triggered on every block (unfortunately), but indexes only every 14,400th block (~8 hours).
- Ethereum: triggered by the `stake()` function call on OlympusStakingV3
- Fantom: triggered by the `rebase()` function call on FantOHM's staking contract (since we don't have a staking contract on Fantom)
- Polygon: triggered on every block (unfortunately), but indexes only every 14,400th block (~8 hours).

Arbitrum and Polygon are triggered on a per-block basis due to a limitation with nodes not supporting tracing. See: <https://github.com/graphprotocol/graph-node/issues/3517> (this applies to BSC, but also to Arbitrum and Polygon)

## Testing

The `matchstick-as` package is used to perform testing on the subgraph code. The syntax is close to that of
`jest`. See this page for examples: <https://github.com/LimeChain/demo-subgraph>

To run tests: `yarn subgraph test <subgraph>`

If you receive a non-sensical test result (e.g. duplicated test cases, or a test failing that should be passing), try running `yarn subgraph test <subgraph> --recompile`. The build cache will sometimes get corrupted/broken.

## Adding Contracts

1. Add the ABI into the `abis/` folder.
1. Add a reference to the ABI under the respective data source in `subgraph.yaml`
1. Run `yarn subgraph codegen <subgraph>` to generate AssemblyScript files from the new ABI(s)

## Deployment

### Deployment - Subgraph Studio and Decentralised Service

1. If necessary, create an account and subgraph in the Subgraph Studio: <https://thegraph.com/studio/>
   - The subgraph should be called `olympus-protocol-metrics`
1. Add the Subgraph Studio deploy key to the `GRAPH_STUDIO_TOKEN` variable in `.env` (using `.env.sample`)
1. Update the `version` property in the `subgraphs/<subgraph>/config.json` file.
1. Run `yarn subgraph build <subgraph>`
1. Run `yarn subgraph deploy:studio <subgraph>`
1. Update the `id` variable in the `subgraphs/<subgraph>/config.json` file with the subgraph id that was displayed in the output.

A URL for the GraphQL Explorer will be provided.

### Deployment - Hosted Service

Some subgraphs are deployed on the Graph Protocol's Hosted Service:

- Going forward, the Graph Network does not yet offer multi-chain indexing, so the hosted service will still be required.
- Note that indexing takes a significant amount of time (weeks!) at the moment. Investigation is required to look into how to improve the indexing performance.

To deploy, do the following:

1. Add the Subgraph Studio deploy key to the `GRAPH_TOKEN_<subgraph>` variable in `.env` (using `.env.sample`)
1. Update the `version` property in the `subgraphs/<subgraph>/config.json` file.
1. Run `yarn subgraph build <subgraph>`
1. Run `yarn subgraph deploy:hosted <subgraph>`
1. Update the `id` variable in the `subgraphs/<subgraph>/config.json` file with the subgraph id that was displayed in the output.
1. Update `CHANGELOG.md`.

### Deployment - Local

A set of Docker containers is pre-configured to enable local testing of the subgraph.

1. Copy the `docker/.env.sample` file to `docker/.env` and set the Alchemy API key
2. Run the Docker stack: `yarn run-local`
3. Create the subgraph in the local graph node: `yarn create-local` (after every restart of the graph node stack)
4. Deploy the subgraph: `yarn deploy-local --version-label 0.1.0`
5. Access the GraphQL query interface: <http://localhost:8000/subgraphs/name/olympus/graphql>

## Constants

### Tokens

Tokens are defined and mapped in the `Constants.ts` file for each chain/subgraph (typically).

To add a new token:

- Define a constant value with the address of the ERC20 contract, with `.toLowerCase()` appended
- Define a constant value with the address of the liquidity pool used for price lookup
- Add the token definition to the `ERC20_TOKENS` map
- Add a mapping under `PAIR_HANDLER` between the ERC20 contract and the liquidity pool contract
- Add the names for the ERC20 contract and liquidity pool to `CONTRACT_NAME_MAP`

### Wallets

Wallets are defined and mapped in the `src/utils/Constants.ts` file.

To add a new wallet:

- Define a constant value with the address of the wallet, with `.toLowerCase()` appended
- Add the constant to the `WALLET_ADDRESSES` array
- Add the name for the wallet to `CONTRACT_NAME_MAP`
- If specific tokens in the wallet should not be reported as part of the treasury, add it to `DAO_WALLET_BLACKLIST`.

### Price Lookup

Price lookups are mapped in the `src/utils/Constants.ts` file.

To add a new price lookup:

- Define a constant value with the address of the liquidity pool (e.g. `PAIR_UNISWAP_V2_ALCX_ETH`), with `.toLowerCase()` appended
- Add an entry to the `LIQUIDITY_POOL_TOKEN_LOOKUP` constant, which maps the pair type (Balancer, Curve, UniswapV2, UniswapV3) to the liquidity pool address

Price lookups are performed in the following manner through the `getUSDRate` function:

- If the token is a stablecoin, return a rate of `1`.
- If the token is one of the base tokens (stablecoin or ETH), return the respective rate.
- Otherwise, use `getPairHandler` to find the appropriate liquidity pool that will enable a price lookup into USD.

### Protocol-Owned Liquidity

Protocol-owned liquidity is mapped in the `src/utils/Constants.ts` file.

To add a new liquidity entry:

- Define a constant value with the address of the liquidity pool (e.g. `PAIR_UNISWAP_V2_ALCX_ETH`), with `.toLowerCase()` appended
- Add an entry to the `LIQUIDITY_OWNED` constant, which maps the pool type (Balancer, Curve, UniswapV2, UniswapV3) to the liquidity pool address
- Add an entry to the `LIQUIDITY_PAIR_TOKENS` constant, which maps the liquidity pool address to the tokens that it is composed of. This could be determined on-chain, but is easier/quicker if done statically.
- If the entry is present in any wallets outside of {WALLET_ADDRESSES}, yet should be reported as part of the tresury, add it to `NON_TREASURY_ASSET_WHITELIST`.
- Add a mock for a zero balance to the respective test helper function (e.g. `mockBalanceVaultZero`), otherwise tests will fail.

### Staked Liquidity

Some liquidity tokens (e.g. Curve OHMETH) can be staked in Convex, which in turn emits a staked token (e.g. cvxOHMETH).

To add a new mapping:

- Define a constant value with the address of the staked token, with `.toLowerCase()` appended
- Create a mapping between the original token (e.g. `ERC20_CRV_OHMETH`) and the staked token (e.g. `ERC20_CVX_OHMETH`) in the `CONVEX_STAKED_TOKENS` map
- Add the Convex staking contract to the `CONVEX_STAKING_CONTRACTS` array

### Contract Addresses

Although Ethereum addresses are not case-sensitive, the mix of uppercase and lowercase letters can create problems when using contract addresses as keys in a map.

To work around this, the following have been implemented:

- At the location where a constant is defined, it is forced into lowercase
- All functions that access `Map` objects convert the given key into lowercase

## Data Structure

### Current Structure

The current schema (as of 3.0.0) has three main entities:

- `TokenRecord`: token-wallet permutations held by the treasury. These records can be aggregated to determine the treasury market value, liquid backing, etc.
- `TokenSupply`: OHM-wallet permutations held by the treasury. These records can be aggregated to determine the OHM circulating and floating supply.
- `ProtocolMetric`: calculated metrics for the protocol, such as the next rebase time, current APY.
  - NOTE: some of the later-added properties (e.g. `treasuryMarketValue` are marked as optional, to work around a `504` error that is encountered while grafting)

As defined in the `subgraph.yaml` file within the `ProtocolMetrics` data source (around line 417), when the `stake` function on the `OlympusStakingV3` contract is called (every rebase or ~8 hours), the indexing of the entities will commence.

Each of these entities (defined in `schema.graphql`) has a unique ID that contains the date in `YYYY-MM-DD` format. Within a single day, subsequent indexing rounds will result in previous values being overwritten. However, any records that are not overwritten will also not be deleted.

#### Caveat: Outdated Blocks

One edge-case that is not currently handled is when a token balance exists in block 1 (resulting in a TokenRecord entity being created), but the token balance is removed in block 2, the TokenRecord for block 1 will not be removed - it will have the same date as other records, but a different block number.

Take the following query as an example:

```graphql
query {
  tokenRecords(orderBy: date, orderDirection: desc, where: { token: "wETH", date: "2022-07-06" }) {
    id
    block
    date
    timestamp
    token
    tokenAddress
    source
    sourceAddress
    balance
    rate
    multiplier
    value
    category
    isLiquid
    isBluechip
  }
}
```

The query results these results:

```json
{
  "data": {
    "tokenRecords": [
      {
        "id": "2022-07-06/Treasury Wallet V3/wETH",
        "block": "15091947",
        "date": "2022-07-06",
        "timestamp": "1657150086",
        "token": "wETH",
        "tokenAddress": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "source": "Treasury Wallet V3",
        "sourceAddress": "0x9a315bdf513367c0377fb36545857d12e85813ef",
        "balance": "9755.083113575199483955",
        "rate": "1193.605651838517369531398265305985",
        "multiplier": "1",
        "value": "11643722.33851783954945621052911067",
        "category": "Volatile",
        "isLiquid": true,
        "isBluechip": true
      },
      {
        "id": "2022-07-06/Treasury Wallet V2/wETH",
        "block": "15091947",
        "date": "2022-07-06",
        "timestamp": "1657150086",
        "token": "wETH",
        "tokenAddress": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "source": "Treasury Wallet V2",
        "sourceAddress": "0x31f8cc382c9898b273eff4e0b7626a6987c846e8",
        "balance": "16.949992098990965551",
        "rate": "1193.605651838517369531398265305985",
        "multiplier": "1",
        "value": "20231.60636797383066804381708794811",
        "category": "Volatile",
        "isLiquid": true,
        "isBluechip": true
      },
      {
        "id": "2022-07-06/LUSD Allocator/wETH",
        "block": "15091947",
        "date": "2022-07-06",
        "timestamp": "1657150086",
        "token": "wETH",
        "tokenAddress": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "source": "LUSD Allocator",
        "sourceAddress": "0x97b3ef4c558ec456d59cb95c65bfb79046e31fca",
        "balance": "0.942594895556590696",
        "rate": "1193.605651838517369531398265305985",
        "multiplier": "1",
        "value": "1125.086594730483637395458609404847",
        "category": "Volatile",
        "isLiquid": true,
        "isBluechip": true
      },
      {
        "id": "2022-07-06/DAO Wallet/wETH",
        "block": "15086325",
        "date": "2022-07-06",
        "timestamp": "1657075064",
        "token": "wETH",
        "tokenAddress": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "source": "DAO Wallet",
        "sourceAddress": "0x245cc372c84b3645bf0ffe6538620b04a217988b",
        "balance": "15598.016502448886308205",
        "rate": "1115.840986512379248158231626289313",
        "multiplier": "1",
        "value": "17404906.1217289366810338171332356",
        "category": "Volatile",
        "isLiquid": true,
        "isBluechip": true
      }
    ]
  }
}
```

Note that while the records with block `15091947` are the latest on 2022-07-06, there also exists a record with block `15086325`. This represents `wETH` in the DAO wallet that was exchanged for a stablecoin.

**Client-side code should filter records for the latest block on each day, as a result.**

A future improvement to this subgraph might modify the behaviour to _not_ overwrite the data in historical blocks, but instead create a `TokenRecordDaySnapshot` that represents the latest block of that day.

### Previous Structure

The previous indexing structure (before 3.0.0) aggregated the equivalents of `TokenRecord` and `TokenSupply` underneath `ProtocolMetric` entities. For each `ProtocolMetric` entitiy, there were some 10-15 properties (e.g. `treasuryMarketValue`), which resulted in blockchain data being indexed multiple times for each block. The current structure indexes only once per block, shifting the aggregation and calculation to the client-side, and results in a 15x improvement in indexing speed.

NOTE: these fields have been re-added and are now calculated without requiring redundant calculations.

### Example Queries

Users should perform aggregation and calculations on the client-side. See the `olympus-frontend` repo for examples of this.

### Conversion from JSON

Follow these steps to convert the JSON data into CSV:

1. Copy everything (including the square bracket, `[`) after `"records":` up to and including the next square bracket in the query results.
2. Open [JSON to CSV Converter](https://konklone.io/json/)
3. Paste the copied content into the field.
4. Download the CSV.

![JSON-to-CSV Demonstration](/assets/json-to-csv.gif)

## Continuous Integration

### Unit Tests

For every pull request, GitHub Actions runs the unit tests. See `.github/workflows/main.yml` for details.

### Query Tests

For every pull request, GitHub Actions runs tests against the current and destination branches' subgraphs. See `.github/workflows/query.yml` for implementation details.

This has a few requirements:

- The subgraph id must be recorded in the `id` property in the `subgraphs/<subgraph>/config.json` file. See the [Deployment - Subgraph Studio](#deployment-subgraph-studio-and-decentralised-service) section of this document for steps.
- Both of the subgraphs must be active (not archived)
- Both of the subgraphs must have overlapping blocks. The latest block of the `branch` subgraph will be determined and the `base` subgraph will be given a query against that block.

These query tests are run in order to:

- Highlight any significant differences in the market value and/or liquid backing between branches.
- Highlight if the consistency of the market value and liquid backing differ for the branch to be merged.

Results are posted as a comment in the GitHub pull request.
