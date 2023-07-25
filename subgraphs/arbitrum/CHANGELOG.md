# Arbitrum Subgraph Changelog

## 1.5.3 (2023-07-18)

- Adds support for the Lending AMO
- Adds manual deployments of OHM to Silo and Sentiment
- Index OHM in treasury wallets
- Amended the event trigger to reduce frequency

## 1.4.3 (2023-05-05)

- Add wETH-OHM and OHM-USDC POL

## 1.3.4 (2023-05-03)

- Add LUSD, LQTY on Arbitrum
- Add OHM on Arbitrum
- Add Chainlink price feeds for LUSD, USDC, WETH
- Add OHM total supply

## 1.2.2 (2023-04-29)

- Populate TokenSupply records with the quantity of protocol-owned gOHM

## 1.1.4 (2023-04-27)

- Adds ARB token
- Shift to event handler as a trigger for indexing, which should be faster than a block handler
