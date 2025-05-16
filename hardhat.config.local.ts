import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          viaIR: true,
        }
      },
      {
        version: "0.8.10",
        settings: {
          viaIR: true,
        }
      },
      {
        version: "0.8.20",
        settings: {
          viaIR: true,
        }
      },
      {
        version: "0.8.21",
        settings: {
          optimizer: { enabled: true, runs: 100 },
          viaIR: true,
        },
      },
      {
        version: "0.8.19",
        settings: {
          optimizer: { enabled: true, runs: 100 },
          viaIR: true,
        },
      },
      {
        version: "0.8.23",
        settings: {
          optimizer: { enabled: true, runs: 100 },
          viaIR: true,
        }
      },
      {
        version: "0.8.17",
        settings: {
          optimizer: { enabled: true, runs: 800 },
          viaIR: true,
        },
      }
    ]
  },
  networks: {
    hardhat: {
      mining: {
        auto: true,
        interval: 0
      }
    },
  },
  // Keep only the basic paths and other essential config
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
};

export default config;
