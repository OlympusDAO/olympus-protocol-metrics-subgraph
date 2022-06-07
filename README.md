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

## Tokens

Tokens are defined and mapped in the `src/utils/Constants.ts` file.

To add a new token:

- Define a constant value with the address of the ERC20 contract
- Define a constant value with the address of the Uniswap V2 or V3 liquidity pool
- Add the token to either the `ERC20_STABLE_TOKENS` or `ERC20_VOLATILE_TOKENS` array (as appropriate).
- Add a mapping under `PAIR_HANDLER` between the ERC20 contract and the liquidity pool contract

## Wallets

Tokens are defined and mapped in the `src/utils/Constants.ts` file.

To add a new wallet:

- Define a constant value with the address of the wallet
- Add the constant to the `WALLET_ADDRESSES` array
