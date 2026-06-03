# Changelog

All notable changes to this project will be documented in this file. Dates are displayed in UTC.

## [v3.0.0] - 2026-06-03

### Breaking: Move to the self-hosted metrics API

The client now targets the self-hosted Olympus treasury metrics API by default.

**Client Package Changes**
- Changed the default base URL to `https://treasury-subgraph-api.olympusdao.finance`.
- Added semantic v2 REST helpers for bounds, daily metrics, treasury assets, and OHM supply.
- Added opt-in `autoPaginate` support for v2 daily helpers.
- Added manifest-backed per-chain indexing progress to the v2 bounds response.
- Bundled `openapi.json` with the package.
- Added `DEFAULT_BASE_URL` export.
- Kept the package framework-agnostic with no runtime dependencies.
- Added a release gate that validates package metadata, tests, audit status, and packed tarball contents.

**Backward Compatibility**
- Preserved `createClient()` and `TreasurySubgraphClient`.
- Preserved legacy `query({ operationName, input })` support for `/operations/*`.
- Preserved typed legacy helper methods and marked them as deprecated.
- Preserved legacy `TokenRecord` and `TokenSupply` type aliases while adding clearer `TreasuryAsset` and `OhmSupply` types.

## [v2.0.0] - 2026-02-06

### Breaking: Remove Wundergraph Dependency

Complete rewrite after Wundergraph was discontinued. API compatibility maintained for consumers.

**Client Package Changes**
- Removed @wundergraph/sdk dependency
- Implemented native fetch HTTP client
- New TreasurySubgraphClient class with same query() interface
- Production URL baked in at build time via __DEFAULT_BASE_URL__
- Added Queries type export for type completeness
- Response format wrapped in { data: T } for Wundergraph compatibility
- Fixed build:prod script to properly load .env.prod using dotenv-cli
- Node.js 20+ required

**Backward Compatibility**
- Same createClient() factory function
- Same query() method signature
- All TypeScript types maintained

## [v1.4.0]

- Change base URL to point to new host

## [v1.3.2]

- Add variable for ignoring cache

## [v1.3.0]

- Re-categorisation of BLV OHM
- Updated to latest subgraph deployments hosted on Arbitrum (but indexing Ethereum and Arbitrum)
- Added calculated metrics on the Metric object, to consolidate calculations
- Added per-chain records for asset and supply metrics (in order to verify calculations) - specified using the `includeRecords` query parameter
- Added values for OHM supply categories (bonds, BLV, etc)
- Added query parameter to return only data where the cross-chain records are up-to-date
- Transferred some properties from ProtocolMetric to Metric, so that ProtocolMetric can be deprecated
- Made protocolMetrics operations internal, where possible

## [v1.2.2]

- Update to @wundergraph/sdk 0.169.0

## [v1.2.1]

- Update to @wundergraph/sdk 0.155.0 and @wundergraph/wunderctl 0.149.0

## [v1.2.0]

- Adds `atBlock/*` operations to retrieve records at the given blocks (one per chain).
- Adds `metrics` operations to retrieve generated cross-chain metrics.

## [v1.1.1](https://github.com/OlympusDAO/treasury-subgraph/compare/v1.1.0...v1.1.1)

- Fixes an issue with building and publishing the NPM package

## [v1.1.0](https://github.com/OlympusDAO/treasury-subgraph/compare/v1.0.5...v1.1.0)

- Bump wundergraph dependencies to take advantage of schema extensions. Fix issue with fetching recent data. Add blockchain property to TokenSupply. Tests! [`ce18346`](https://github.com/OlympusDAO/treasury-subgraph/commit/ce18346496ba0ab0b67155d1ad353d0dc4de81d1)
- Ensure manipulated results are sorted in descending order [`c57268b`](https://github.com/OlympusDAO/treasury-subgraph/commit/c57268bc20d256bce0b42253a855541653ee5a80)
- Actually in descending order [`68146b6`](https://github.com/OlympusDAO/treasury-subgraph/commit/68146b68e8fd5c4f5570590298e9611adfb129a6)
- Fix issue with fetching for recent dates [`c7c63d4`](https://github.com/OlympusDAO/treasury-subgraph/commit/c7c63d4a430d02ed563875a37e02ce134cae750d)
- Idiot-proof building and running tests [`01161b9`](https://github.com/OlympusDAO/treasury-subgraph/commit/01161b96aa954978bdbe2c255290e0f09956b2cc)

## [v1.0.5](https://github.com/OlympusDAO/treasury-subgraph/compare/v1.0.3...v1.0.5)

> 3 May 2023

- Filter TokenSupply records by the latest block per day per blockchain [`358521f`](https://github.com/OlympusDAO/treasury-subgraph/commit/358521f873f644a0bddf3f84fe414d969c424b3d)
- Add blockchain property to TokenSupply [`468fd1a`](https://github.com/OlympusDAO/treasury-subgraph/commit/468fd1a9a7d725fe29a28cbb1d9c053419b43e0f)
- Less aggressive live query [`e7a4b77`](https://github.com/OlympusDAO/treasury-subgraph/commit/e7a4b772a5ca532a2d871cf16705b49734c15960)
- Add more aggressive caching [`6a2137f`](https://github.com/OlympusDAO/treasury-subgraph/commit/6a2137f8b9cfba97d0e3ddb761e4543a0e511960)
- Allow local development [`b80be3d`](https://github.com/OlympusDAO/treasury-subgraph/commit/b80be3dd6f44dc7a0e80fe32ed51c93a7f06c2de)

## [v1.0.3]

> 2 May 2023

- Initial version
