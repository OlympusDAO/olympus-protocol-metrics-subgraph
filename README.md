# Olympus Protocl Metrics Subgraph

Gathers data from bonds, liquidity and Olympus treasury.

Used in the dashboard https://app.olympusdao.finance/ and the Olympus Playground.

Deployed at https://thegraph.com/hosted-service/subgraph/drondin/olympus-protocol-metrics

## Local Testing

A set of Docker containers is pre-configured to enable local testing of the subgraph.

1. Copy the `docker/.env.sample` file to `docker/.env` and set the Alchemy API key
2. Run the Docker stack: `yarn run-local`
3. Create the subgraph in the local graph node: `yarn create-local` (after every restart of the graph node stack)
4. Deploy the subgraph: `yarn deploy-local --version-label 0.1.0`
5. Access the GraphQL query interface: http://localhost:8000/subgraphs/name/olympus/graphql

TODO note about reasons for schema design with \*components

## Deployment (Testing)

1. Update the `SUBGRAPH_VERSION` variable in the `.subgraph-version` file.
2. Run `yarn deploy-studio`
