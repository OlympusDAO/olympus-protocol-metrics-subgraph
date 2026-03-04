import { createConfig } from "ponder";
import { http } from "viem";

// ABIs for trigger contracts
import ChainlinkAggregatorAbi from "./abis/ChainlinkAggregator.json";
import ERC20Abi from "./abis/ERC20.json";

export default createConfig({
  ordering: "multichain",
  networks: {
    arbitrum: {
      chainId: 42161,
      transport: http(process.env.PONDER_RPC_URL_ARBITRUM),
    },
    base: {
      chainId: 8453,
      transport: http(process.env.PONDER_RPC_URL_BASE),
    },
    berachain: {
      chainId: 80094,
      transport: http(process.env.PONDER_RPC_URL_BERACHAIN),
    },
    polygon: {
      chainId: 137,
      transport: http(process.env.PONDER_RPC_URL_POLYGON),
    },
    fantom: {
      chainId: 250,
      transport: http(process.env.PONDER_RPC_URL_FANTOM),
    },
  },
  contracts: {
    // Arbitrum: triggered by Chainlink FRAX-USD NewRound events (~16h interval)
    ChainlinkTriggerArbitrum: {
      abi: ChainlinkAggregatorAbi,
      network: "arbitrum",
      address: "0x5D041081725468Aa43e72ff0445Fde2Ad1aDE775",
      startBlock: 84000000,
      filter: {
        event: "NewRound",
      },
    },
    // Base: triggered by Chainlink price feed events
    ChainlinkTriggerBase: {
      abi: ChainlinkAggregatorAbi,
      network: "base",
      address: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B",
      startBlock: 1,
      filter: {
        event: "NewRound",
      },
    },
    // Berachain: triggered by OHM ERC20 Transfer events
    OhmTransferBerachain: {
      abi: ERC20Abi,
      network: "berachain",
      address: "0x18878Df23e2a36f81e820e4b47b4A40576D3159C",
      startBlock: 1,
      filter: {
        event: "Transfer",
      },
    },
  },
  blocks: {
    // Polygon: polling block handler (~daily at 2s blocks)
    PolygonPolling: {
      network: "polygon",
      startBlock: 25000000,
      interval: 43200,
    },
    // Fantom: polling block handler (~daily at 1s blocks)
    FantomPolling: {
      network: "fantom",
      startBlock: 33000000,
      interval: 86400,
    },
    // Berachain: fallback polling in addition to event trigger (~4h)
    BerachainPolling: {
      network: "berachain",
      startBlock: 1,
      interval: 7200,
    },
  },
});
