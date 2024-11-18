import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require('dotenv').config();


let mnemonic = 'test '.repeat(11) + 'junk'

function getNetwork1(url: string) {
  return {
    url,
    accounts: [process.env.PRIVATE_KEY2 as string, process.env.PRIVATE_KEY as string]
  };
}

function getNetworkTestBalance(url: string) {
  return {
    url,
    accounts: [process.env.PRIVATE_KEY_TEST_BALANCE as string]
  };
}

// Only use for prod deployments of Registry and Account Factory, other contracts need to be done with PRIVATE_KEY_2
function getNetworkProd(url: string) {
  return {
    url,
    accounts: [process.env.REGISTRY_DEPLOYMENT_KEY as string] // Change after registry and factory deployment
  };
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
      },
      {
        version: "0.8.10",
      },
      {
        version: "0.8.20",
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
          optimizer: { enabled: true, runs: 100 }
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
    dev: {
      url: "http://127.0.0.1:8545",
    },
    hardhat: {
      forking: {
          url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`, // or use Alchemy
          blockNumber: 21128662 // Optional: specify a block number to fork from
      }
    },
    dev2: {url: "https://127.0.0.1:4200"},
    arbitrumSepolia: {
      url: "https://arbitrum-sepolia.infura.io/v3/" + process.env.INFURA_API_KEY,
      accounts: [process.env.PRIVATE_KEY as string], // replace with your private key
    },
    // sepolia: {
    //   url: "https://sepolia.infura.io/v3/" + process.env.INFURA_API_KEY,
    //   accounts: [process.env.PRIVATE_KEY as string], // replace with your private key
    // },
    // opSepolia: getNetwork1("https://optimism-sepolia.infura.io/v3/" + process.env.INFURA_API_KEY),
    // arbSepolia: getNetwork1("https://arbitrum-sepolia.infura.io/v3/" + process.env.INFURA_API_KEY),

    // Test Balance Network Configs
    sepolia: getNetworkTestBalance("https://sepolia.infura.io/v3/" + process.env.INFURA_API_KEY),
    opSepolia: getNetworkTestBalance("https://optimism-sepolia.infura.io/v3/" + process.env.INFURA_API_KEY),
    arbSepolia: getNetworkTestBalance("https://arbitrum-sepolia.infura.io/v3/" + process.env.INFURA_API_KEY),
    //////////////////////////////////////////////////////////////
    
    amoy: getNetwork1("https://polygon-amoy.infura.io/v3/" + process.env.INFURA_API_KEY),
    kakarotSepolia: getNetwork1("https://sepolia-rpc.kakarot.org"),
    kakarotSepoliaNew: getNetwork1("https://rpc-kakarot-sepolia.karnot.xyz"),
    // kakarotSepoliaNew: getNetworkProd("https://rpc-kakarot-sepolia.karnot.xyz"),

    ethmain: getNetwork1("https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    opmain: getNetwork1("https://optimism-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    arbmain: getNetwork1("https://arbitrum-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    // polymain: getNetwork1("https://polygon-mainnet.infura.io/v3/16fb3743839e4f80841b0401a68a020f"),
    basemain: getNetwork1("https://1rpc.io/base"),
    avaxmain: getNetwork1("https://avalanche-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),

    ethmain2: getNetworkProd("https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    opmain2: getNetworkProd("https://optimism-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    arbmain2: getNetworkProd("https://arbitrum-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    // polymain2: getNetwork1("https://polygon-mainnet.infura.io/v3/16fb3743839e4f80841b0401a68a020f"),
    basemain2: getNetworkProd("https://1rpc.io/base"),
    avaxmain2: getNetworkProd("https://avalanche-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
  
    // bnbmain: getNetworkProd("https://bsc-mainnet.infura.io/v3/16fb3743839e4f80841b0401a68a020f"),  
    // scrollmain: {},
    // blastmain: {},
    // beramain: {},
    // monadmain: {},
    // kakarotmain: {},
  },
  etherscan: {
    apiKey: {
      opSepolia: process.env.OP_SCAN_API_KEY as string,
      arbSepolia: "MD9NYEJGPWUSBESQP9QQGFTB4G4EKKU69U",
      opmain: process.env.OP_SCAN_API_KEY as string,
      arbmain: process.env.ARB_SCAN_API_KEY as string,
    },
    customChains: [
      {
        network: 'amoy',
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com/",
        },
      },
      {
        network: 'arbSepolia',
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: 'opSepolia',
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimistic.etherscan.io/",
        },
      },
      {
        network: "opmain",
        chainId: 10,
        urls: {
          apiURL: "https://api-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io/",
        },
      },
      {
        network: "arbmain",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io/",
        },
      },
    ],
  }
};

export default config;
