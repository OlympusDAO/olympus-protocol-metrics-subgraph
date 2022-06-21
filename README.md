# Olympus Protocl Metrics Subgraph

Gathers data from bonds, liquidity and Olympus treasury.

Used in the dashboard https://app.olympusdao.finance/ and the Olympus Playground.

Deployed at https://thegraph.com/hosted-service/subgraph/drondin/olympus-protocol-metrics

## Local Deployment

A set of Docker containers is pre-configured to enable local testing of the subgraph.

1. Copy the `docker/.env.sample` file to `docker/.env` and set the Alchemy API key
2. Run the Docker stack: `yarn run-local`
3. Create the subgraph in the local graph node: `yarn create-local` (after every restart of the graph node stack)
4. Deploy the subgraph: `yarn deploy-local --version-label 0.1.0`
5. Access the GraphQL query interface: http://localhost:8000/subgraphs/name/olympus/graphql

TODO note about reasons for schema design with \*components

## Testing

The `matchstick-as` package is used to perform testing on the subgraph code. The syntax is close to that of
`jest`. See this page for examples: <https://github.com/LimeChain/demo-subgraph>

## Deployment (Testing)

1. Update the `SUBGRAPH_VERSION` variable in the `.subgraph-version` file.
2. Run `yarn deploy-studio`

## Deployment (Production)

This subgraph is deployed on the Graph Protocol's Hosted Service:

- For historical reasons, as the hosted service was the only option at the time
- Going forward, the Graph Network does not yet offer multi-chain indexing, so the hosted service will still be required

To deploy, do the following:

1. Obtain the Graph deployment token
2. Copy the .env.sample file to .env and set the value of the `GRAPH_TOKEN` variable
3. Run `yarn auth`
4. Run `yarn deploy`

## Tokens

Tokens are defined and mapped in the `src/utils/Constants.ts` file.

To add a new token:

- Define a constant value with the address of the ERC20 contract, with `.toLowerCase()` appended
- Define a constant value with the address of the Uniswap V2 or V3 liquidity pool
- Add the token to either the `ERC20_STABLE_TOKENS` or `ERC20_VOLATILE_TOKENS` array (as appropriate)
- Add a mapping under `PAIR_HANDLER` between the ERC20 contract and the liquidity pool contract

## Wallets

Tokens are defined and mapped in the `src/utils/Constants.ts` file.

To add a new wallet:

- Define a constant value with the address of the wallet
- Add the constant to the `WALLET_ADDRESSES` array

## Price Lookup

Price lookups are mapped in the `src/utils/Constants.ts` file.

To add a new price lookup:

- Define a constant value with the address of the liquidity pool (e.g. `PAIR_UNISWAP_V2_ALCX_ETH`), with `.toLowerCase()` appended
- Add an entry to the `LIQUIDITY_POOL_TOKEN_LOOKUP` constant, which maps the pair type (Balancer, Curve, UniswapV2, UniswapV3) to the liquidity pool address

## Protocol-Owned Liquidity

Protocol-owned liquidity is mapped in the `src/utils/Constants.ts` file.

To add a new liquidity entry:

- Define a constant value with the address of the liquidity pool (e.g. `PAIR_UNISWAP_V2_ALCX_ETH`), with `.toLowerCase()` appended
- Add an entry to the `LIQUIDITY_OWNED` constant, which maps the pool type (Balancer, Curve, UniswapV2, UniswapV3) to the liquidity pool address
- Add an entry to the `LIQUIDITY_PAIR_TOKENS` constant, which maps the liquidity pool address to the tokens that it is composed of. This could be determined on-chain, but is easier/quicker if done statically.

## Staked Liquidity

Some liquidity tokens (e.g. Curve OHMETH) can be staked in Convex, which in turn emits a staked token (e.g. cvxOHMETH).

To add a new mapping:

- Define a constant value with the address of the staked token, with `.toLowerCase()` appended
- Create a mapping between the original token (e.g. `ERC20_CRV_OHMETH`) and the staked token (e.g. `ERC20_CVX_OHMETH`) in the `CONVEX_STAKED_TOKENS` map
- Add the Convex staking contract to the `CONVEX_STAKING_CONTRACTS` array

## Contract Addresses

Although Ethereum addresses are not case-sensitive, the mix of uppercase and lowercase letters can create problems when using contract addresses as keys in a map.

To work around this, the following have been implemented:

- At the location where a constant is defined, it is forced into lowercase
- All functions that access `Map` objects convert the given key into lowercase

## Debugging

Each metric has a "component" variant that contains the details of the assets that are summed to result in the reported value.

For example, the `treasuryTotalBacking` metric has `treasuryTotalBackingComponents`.

The components metric returns data in the JSON format, along with some other fields, like so:

```
{
  "data": {
    "protocolMetrics": [
      {
        "treasuryTotalBacking": "285181793.651670185456244127885338",
        "treasuryTotalBackingComponents": {
          "id": "Treasury total backing",
          "value": "285181793.651670185456244127885338",
          "records": [
            {
              "id": "aDAI-Aave Allocator V1",
              "name": "aDAI",
              "source": "Aave Allocator V1",
              "sourceAddress": "0x0e1177e47151Be72e5992E0975000E73Ab5fd9D4",
              "rate": "1",
              "balance": "1193.105551740279585601",
              "multiplier": "1",
              "value": "1193.105551740279585601"
            },
            {
              "id": "aDAI-Aave Allocator V2",
              "name": "aDAI",
              "source": "Aave Allocator V2",
              "sourceAddress": "0x0d33c811d0fcc711bcb388dfb3a152de445be66f",
              "rate": "1",
              "balance": "20082162.733244277829630239",
              "multiplier": "1",
              "value": "20082162.733244277829630239"
            },
            {
              "id": "CRV-Treasury Wallet V2",
              "name": "CRV",
              "source": "Treasury Wallet V2",
              "sourceAddress": "0x31f8cc382c9898b273eff4e0b7626a6987c846e8",
              "rate": "1.153337370306064963088432321839679",
              "balance": "2892.831029258640312282",
              "multiplier": "1",
              "value": "3336.410132024947489734418007556109"
            },
            {
              "id": "CRV-Treasury Wallet V3",
              "name": "CRV",
              "source": "Treasury Wallet V3",
              "sourceAddress": "0x9A315BdF513367C0377FB36545857d12e85813Ef",
              "rate": "1.153337370306064963088432321839679",
              "balance": "244798.99553808034947349",
              "multiplier": "1",
              "value": "282335.8297674557206438837121333845"
            },
            {
              "id": "CVX-Convex Allocator",
              "name": "CVX",
              "source": "Convex Allocator",
              "sourceAddress": "0xdfc95aaf0a107daae2b350458ded4b7906e7f728",
              "rate": "7.480534627839536293399351502268616",
              "balance": "4.692582914096926854",
              "multiplier": "1",
              "value": "35.10302898291022143180323490796396"
            },
            {
              "id": "DAI-Cross-Chain Polygon",
              "name": "DAI",
              "source": "Cross-Chain Polygon",
              "sourceAddress": "0xe06efa3d9ee6923240ee1195a16ddd96b5cce8f7",
              "rate": "1",
              "balance": "3005.118301134873382579",
              "multiplier": "1",
              "value": "3005.118301134873382579"
            },
            {
              "id": "DAI-Rari Allocator",
              "name": "DAI",
              "source": "Rari Allocator",
              "sourceAddress": "0x061C8610A784b8A1599De5B1157631e35180d818",
              "rate": "1",
              "balance": "10032458.099156813520497944",
              "multiplier": "1",
              "value": "10032458.099156813520497944"
            },
            {
              "id": "DAI-Treasury Wallet V2",
              "name": "DAI",
              "source": "Treasury Wallet V2",
              "sourceAddress": "0x31f8cc382c9898b273eff4e0b7626a6987c846e8",
              "rate": "1",
              "balance": "987056.665661758046988559",
              "multiplier": "1",
              "value": "987056.665661758046988559"
            },
            {
              "id": "DAI-Treasury Wallet V3",
              "name": "DAI",
              "source": "Treasury Wallet V3",
              "sourceAddress": "0x9A315BdF513367C0377FB36545857d12e85813Ef",
              "rate": "1",
              "balance": "83836606.706591201977902038",
              "multiplier": "1",
              "value": "83836606.706591201977902038"
            },
            {
              "id": "FEI-Treasury Wallet V3",
              "name": "FEI",
              "source": "Treasury Wallet V3",
              "sourceAddress": "0x9A315BdF513367C0377FB36545857d12e85813Ef",
              "rate": "1",
              "balance": "50000000",
              "multiplier": "1",
              "value": "50000000"
            },
            {
              "id": "FRAX-Convex Allocator 1",
              "name": "FRAX",
              "source": "Convex Allocator 1",
              "sourceAddress": "0x3dF5A355457dB3A4B5C744B8623A7721BF56dF78",
              "rate": "1",
              "balance": "35.509289089",
              "multiplier": "1",
              "value": "35.509289089"
            },
            {
              "id": "FRAX-Convex Allocator 3",
              "name": "FRAX",
              "source": "Convex Allocator 3",
              "sourceAddress": "0xDbf0683fC4FC8Ac11e64a6817d3285ec4f2Fc42d",
              "rate": "1",
              "balance": "25000001",
              "multiplier": "1",
              "value": "25000001"
            },
            {
              "id": "FRAX-Treasury Wallet V3",
              "name": "FRAX",
              "source": "Treasury Wallet V3",
              "sourceAddress": "0x9A315BdF513367C0377FB36545857d12e85813Ef",
              "rate": "1",
              "balance": "33307662.105234158848424197",
              "multiplier": "1",
              "value": "33307662.105234158848424197"
            },
            {
              "id": "FXS-Convex Allocator",
              "name": "FXS",
              "source": "Convex Allocator",
              "sourceAddress": "0xdfc95aaf0a107daae2b350458ded4b7906e7f728",
              "rate": "6.265684170131060406102729320219385",
              "balance": "15912.146075292016836608",
              "multiplier": "1",
              "value": "99700.48177677027034710194434007098"
            },
            {
              "id": "FXS-Treasury Wallet V2",
              "name": "FXS",
              "source": "Treasury Wallet V2",
              "sourceAddress": "0x31f8cc382c9898b273eff4e0b7626a6987c846e8",
              "rate": "6.265684170131060406102729320219385",
              "balance": "2862.532428489897995764",
              "multiplier": "1",
              "value": "17935.72412367597553953333986458813"
            },
            {
              "id": "FXS-Treasury Wallet V3",
              "name": "FXS",
              "source": "Treasury Wallet V3",
              "sourceAddress": "0x9A315BdF513367C0377FB36545857d12e85813Ef",
              "rate": "6.265684170131060406102729320219385",
              "balance": "6866.524959230980521984",
              "multiplier": "1",
              "value": "43023.47674086337957984482498960055"
            },
            {
              "id": "LUSD-Liquity Stability Pool",
              "name": "LUSD",
              "source": "Liquity Stability Pool",
              "sourceAddress": "0x66017d22b0f8556afdd19fc67041899eb65a21bb",
              "rate": "1",
              "balance": "17223938.722478302391217284",
              "multiplier": "1",
              "value": "17223938.722478302391217284"
            },
            {
              "id": "OHM Circulating Supply-N/A",
              "name": "OHM Circulating Supply",
              "source": "N/A",
              "sourceAddress": "0x0",
              "rate": "1",
              "balance": "20645289.714390139",
              "multiplier": "-1",
              "value": "-20645289.714390139"
            },
            {
              "id": "OHM-DAI Pair V2-Treasury Wallet V3",
              "name": "OHM-DAI Pair V2",
              "source": "Treasury Wallet V3",
              "sourceAddress": "0x9A315BdF513367C0377FB36545857d12e85813Ef",
              "rate": "272567.8479205609745704447813160705",
              "balance": "132.170296734877254208",
              "multiplier": "0.5",
              "value": "18012686.67002372008013486554878464"
            },
            {
              "id": "OHM-ETH Pair V2-Treasury Wallet V3",
              "name": "OHM-ETH Pair V2",
              "source": "Treasury Wallet V3",
              "sourceAddress": "0x9A315BdF513367C0377FB36545857d12e85813Ef",
              "rate": "12159501.1040735859165383243163325",
              "balance": "1.088381612140580339",
              "multiplier": "0.5",
              "value": "6617088.707238387996872008934140675"
            },
            {
              "id": "TRIBE-Rari Allocator",
              "name": "TRIBE",
              "source": "Rari Allocator",
              "sourceAddress": "0x061C8610A784b8A1599De5B1157631e35180d818",
              "rate": "0.2188420372587132910146845372190802",
              "balance": "3753516.450398610388427468",
              "multiplier": "1",
              "value": "821427.1868893259531332097313074828"
            },
            {
              "id": "UST-Treasury Wallet V3",
              "name": "UST",
              "source": "Treasury Wallet V3",
              "sourceAddress": "0x9A315BdF513367C0377FB36545857d12e85813Ef",
              "rate": "1",
              "balance": "4642891.981479",
              "multiplier": "1",
              "value": "4642891.981479"
            },
            {
              "id": "vlCVX V2-Convex vlCVX Allocator",
              "name": "vlCVX V2",
              "source": "Convex vlCVX Allocator",
              "sourceAddress": "0x2d643df5de4e9ba063760d475beaa62821c71681",
              "rate": "7.480534627839536293399351502268616",
              "balance": "877321.617954793985555315",
              "multiplier": "1",
              "value": "6562834.742863044668854761371707289"
            },
            {
              "id": "wBTC-Treasury Wallet V3",
              "name": "wBTC",
              "source": "Treasury Wallet V3",
              "sourceAddress": "0x9A315BdF513367C0377FB36545857d12e85813Ef",
              "rate": "30391.83564322825013480357520856753",
              "balance": "20.02006349",
              "multiplier": "1",
              "value": "608446.4791550745562603686343545119"
            },
            {
              "id": "wETH-Treasury Wallet V2",
              "name": "wETH",
              "source": "Treasury Wallet V2",
              "sourceAddress": "0x31f8cc382c9898b273eff4e0b7626a6987c846e8",
              "rate": "1801.740138321600922379871060941984",
              "balance": "16.949992098990965551",
              "multiplier": "1",
              "value": "30539.48110898602502597900731047378"
            },
            {
              "id": "wETH-Treasury Wallet V3",
              "name": "wETH",
              "source": "Treasury Wallet V3",
              "sourceAddress": "0x9A315BdF513367C0377FB36545857d12e85813Ef",
              "rate": "1801.740138321600922379871060941984",
              "balance": "11194.007350187647991199",
              "multiplier": "1",
              "value": "20168692.3515001103065057129607512"
            },
            {
              "id": "xSUSHI-Treasury Wallet V2",
              "name": "xSUSHI",
              "source": "Treasury Wallet V2",
              "sourceAddress": "0x31f8cc382c9898b273eff4e0b7626a6987c846e8",
              "rate": "1.966645116195768239472909833942913",
              "balance": "1765.992536278834534925",
              "multiplier": "1",
              "value": "3473.080596710948002031988963250699"
            }
          ]
        }
      }
    ],
    "_meta": {
      "block": {
        "number": 14931462
      }
    }
  }
}
```

Follow these steps to convert the JSON data into CSV:

1. Copy everything (including the square bracket, `[`) after `"records": ` up to and including the next square bracket in the query results.
2. Open [JSON to CSV Converter](https://konklone.io/json/)
3. Paste the copied content into the field.
4. Download the CSV.

![JSON-to-CSV Demonstration](/assets/json-to-csv.gif)
