# Olympus Protocl Metrics Subgraph

Gathers data from bonds, liquidity and Olympus treasury.

Used in the dashboard https://app.olympusdao.finance/ and the Olympus Playground.

Deployed at https://thegraph.com/hosted-service/subgraph/olympusdao/olympus-protocol-metrics

## Initial Setup

Run `yarn`

## Writing AssemblyScript

Note that the Graph Protocol compiles from AssemblyScript to WASM. AssemblyScript is strongly-typed, and is similar to TypeScript. However, there are a number of expected features of TypeScript (e.g. try/catch) that aren't implemented in AssemblyScript. A few suggestions:

- Utilise the linting that has been set up in this repository
- Build frequently (`yarn build`), as linting does not pick up all problems
- Variables that are nullable need to be typed accordingly
- You may run into a TS2322 compiler error when handling null values. The workaround for this is to use the strict equality operator (`===`), instead of loose equality (`==`) or negation (`!someValue`). e.g. `if (someValue === null)`. This is due to a [limitation in the AssemblyScript compiler.](https://github.com/AssemblyScript/assemblyscript/issues/2223#issuecomment-1069245834)
- The Graph Protocol Discord is very helpful to get support. See the `subgraph-development` channel.

## Testing

The `matchstick-as` package is used to perform testing on the subgraph code. The syntax is close to that of
`jest`. See this page for examples: <https://github.com/LimeChain/demo-subgraph>

To run tests: `yarn test`

If you receive a non-sensical test result (e.g. duplicated test cases, or a test failing that should be passing), try running `yarn test:force`. The build cache will sometimes get corrupted/broken.

## Adding Contracts

1. Add the ABI into the `abis/` folder.
1. Add a reference to the ABI under the respective data source in `subgraph.yaml`
1. Run `yarn codegen` to generate AssemblyScript files from the new ABI(s)

## Deployment

### Deployment (Testing)

1. If necessary, create an account and subgraph in the Subgraph Studio: https://thegraph.com/studio/
   - The subgraph should be called `olympus-protocol-metrics`
1. Add the Subgraph Studio deploy key to the `GRAPH_STUDIO_TOKEN` variable in `.env` (using `.env.sample`)
1. Authenticate using `yarn auth:dev`
1. Update the `SUBGRAPH_VERSION` variable in the `.subgraph-version` file.
1. Run `yarn build`
1. Run `yarn deploy:dev`

A URL for the GraphQL Explorer will be provided.

### Deployment (Production)

This subgraph is deployed on the Graph Protocol's Hosted Service:

- For historical reasons, as the hosted service was the only option at the time.
- Going forward, the Graph Network does not yet offer multi-chain indexing, so the hosted service will still be required.
- Note that indexing takes a significant amount of time (weeks!) at the moment. Investigation is required to look into how to improve the indexing performance.

To deploy, do the following:

1. Add the Subgraph Studio deploy key to the `GRAPH_TOKEN` variable in `.env` (using `.env.sample`)
1. Authenticate using `yarn auth`
1. Run `yarn build`
1. Run `yarn deploy`

### Deployment (Local)

A set of Docker containers is pre-configured to enable local testing of the subgraph.

1. Copy the `docker/.env.sample` file to `docker/.env` and set the Alchemy API key
2. Run the Docker stack: `yarn run-local`
3. Create the subgraph in the local graph node: `yarn create-local` (after every restart of the graph node stack)
4. Deploy the subgraph: `yarn deploy-local --version-label 0.1.0`
5. Access the GraphQL query interface: http://localhost:8000/subgraphs/name/olympus/graphql

## Constants

### Tokens

Tokens are defined and mapped in the `src/utils/Constants.ts` file.

To add a new token:

- Define a constant value with the address of the ERC20 contract, with `.toLowerCase()` appended
- Define a constant value with the address of the Uniswap V2 or V3 liquidity pool
- Add the token to either the `ERC20_STABLE_TOKENS` or `ERC20_VOLATILE_TOKENS` array (as appropriate)
- Add a mapping under `PAIR_HANDLER` between the ERC20 contract and the liquidity pool contract
- If the token is present in any wallets outside of `WALLET_ADDRESSES`, yet should be reported as part of the tresury, add it to {NON_TREASURY_ASSET_WHITELIST}.

### Wallets

Tokens are defined and mapped in the `src/utils/Constants.ts` file.

To add a new wallet:

- Define a constant value with the address of the wallet
- Add the constant to the `WALLET_ADDRESSES` array

### Price Lookup

Price lookups are mapped in the `src/utils/Constants.ts` file.

To add a new price lookup:

- Define a constant value with the address of the liquidity pool (e.g. `PAIR_UNISWAP_V2_ALCX_ETH`), with `.toLowerCase()` appended
- Add an entry to the `LIQUIDITY_POOL_TOKEN_LOOKUP` constant, which maps the pair type (Balancer, Curve, UniswapV2, UniswapV3) to the liquidity pool address

Price lookups are performed in the following manner through the `getUSDRate` function:

- If the token is a stablecoin, return a rate of `1`.
- If the token is one of the base tokens (OHM or ETH), return the respective rate.
- Otherwise, use `getPairHandler` to find the appropriate liquidity pool that will enable a price lookup into USD.

### Protocol-Owned Liquidity

Protocol-owned liquidity is mapped in the `src/utils/Constants.ts` file.

To add a new liquidity entry:

- Define a constant value with the address of the liquidity pool (e.g. `PAIR_UNISWAP_V2_ALCX_ETH`), with `.toLowerCase()` appended
- Add an entry to the `LIQUIDITY_OWNED` constant, which maps the pool type (Balancer, Curve, UniswapV2, UniswapV3) to the liquidity pool address
- Add an entry to the `LIQUIDITY_PAIR_TOKENS` constant, which maps the liquidity pool address to the tokens that it is composed of. This could be determined on-chain, but is easier/quicker if done statically.
- If the entry is present in any wallets outside of {WALLET_ADDRESSES}, yet should be reported as part of the tresury, add it to `NON_TREASURY_ASSET_WHITELIST`.

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

There are a number of inter-related components in the metrics:

- The schema is defined in the `schema.graphql` file
  - Some metrics return integer or decimal values (e.g. `treasuryMarketValue`)
  - Alongside the decimal values are additional values suffixed by `Components` (e.g. `treasuryMarketValueComponents`). These give a detailed breakdown of the tokens and source contracts/wallets. See the Debugging section below for more detail.
  - Any changes to the `schema.graphql` file need to be applied by running `yarn codegen`, which will generate/update the `generated/schema.ts` file.
- Nested objects are supported in the GraphQL schema (e.g. `ProtocolMetric` is related to `TokenRecords`), but it is not immediately obvious how to use them.

  - The functions generated and written to the `schema.ts` file will not directly reference the related entity in the getters and setters. For example:

  ```typescript
    get treasuryRiskFreeValueComponents(): string {
      let value = this.get("treasuryRiskFreeValueComponents");
      return value!.toString();
    }

    set treasuryRiskFreeValueComponents(value: string) {
      this.set("treasuryRiskFreeValueComponents", Value.fromString(value));
    }
  ```

  - Instead, the `id` of an entity is used. A `TokenRecords` entity is instantiated with a unique `id` (e.g. `TreasuryMarketValue`), and can be loaded (`load(id: string)`) and saved (`save()`) accordingly. The `id` should be passed to the setter to link the `TokenRecords` entity to the `ProtocolMetric`.
  - Explicit loading and saving of `TokenRecords` and `TokenRecord` objects should not be required, however, as it is all handled through the `TokenRecordHelper` module.

- A `metricName` parameter is passed from the top-level (`ProtocolMetrics` module) down into the different levels of utility functions that index the blockchain data. The `metricName` is used, alongside the block number, to create an `id` that is unique. Not using the `metricName` results in data from one metric (e.g. liquid backing) clobbering that of another metric (e.g. total backing).

### Value Components

Each metric has a "component" variant that contains the details of the assets that are summed to result in the reported value.

For example, the `treasuryTotalBacking` metric has `treasuryTotalBackingComponents`.

The components metric returns data in the JSON format, along with some other fields, like so:

```json
{
  "data": {
    "protocolMetrics": [
      {
        "treasuryMarketValueComponents": {
          "value": "431707239.3836405267139378357370496",
          "records": [
            {
              "id": "MarketValue-aDAI-Aave Allocator V1-14381377",
              "token": "aDAI",
              "tokenAddress": "0x028171bca77440897b824ca71d1c56cac55b68a3",
              "source": "Aave Allocator V1",
              "sourceAddress": "0x0e1177e47151be72e5992e0975000e73ab5fd9d4",
              "balance": "10657221.863207801175897664",
              "rate": "1",
              "multiplier": "1",
              "value": "10657221.863207801175897664"
            }
          ]
        }
      }
    ]
  }
}
```

Follow these steps to convert the JSON data into CSV:

1. Copy everything (including the square bracket, `[`) after `"records": ` up to and including the next square bracket in the query results.
2. Open [JSON to CSV Converter](https://konklone.io/json/)
3. Paste the copied content into the field.
4. Download the CSV.

![JSON-to-CSV Demonstration](/assets/json-to-csv.gif)
