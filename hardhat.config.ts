import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
require('dotenv').config();

let mnemonic = 'test '.repeat(11) + 'junk'

function getNetwork1(url: string) {
  return {
    url,
    accounts: [process.env.PRIVATE_KEY2 as string, process.env.PRIVATE_KEY as string, process.env.ODYSSEY_TEST_KEY as string],
    loggingEnabled: true,
    traces: true,
  };
}

function getNetwork2(url: string) {
  return {
    url,
    accounts: [process.env.ODYSSEY_TEST_KEY as string, process.env.PRIVATE_KEY2 as string],
    loggingEnabled: true,
    traces: true,
  };
}

function getNetworkTestBalance(url: string) {
  return {
    url,
    accounts: [process.env.PRIVATE_KEY_TEST_BALANCE as string]
  };
}

// Only use for prod deployments of Registry and Account Factory, other contracts need to be done with PRIVATE_KEY_2
// function getNetworkProd(url: string) {
//   return {
//     url,
//     // accounts: [process.env.REGISTRY_DEPLOYMENT_KEY as string] // Change after registry and factory deployment
//     accounts: [process.env.SMART_ACC_DEP_KEY as string] // SmartAccountFactoryV1 deployment
//   };
// }

function getNetworkMaster(url: string) {
  return {
    url,
    // accounts: [process.env.REGISTRY_DEPLOYMENT_KEY as string] // Change after registry and factory deployment
    accounts: [process.env.PRIVATE_KEY_MASTER as string] // SmartAccountFactoryV1 deployment
  };
}

function getNetworkReg(url: string) {
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
          optimizer: { enabled: true, runs: 200 },
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
    dev: {
      url: "http://127.0.0.1:8545",
    },
    anvil: {
      url: "http://127.0.0.1:8546",
    },
    hardhat: {
      mining: {
        auto: true,
        interval: 0
      },
      chainId: 31337,
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
    sepolia: getNetwork2("https://sepolia.infura.io/v3/" + process.env.INFURA_API_KEY),
    opSepolia: getNetwork2("https://optimism-sepolia.infura.io/v3/" + process.env.INFURA_API_KEY),
    arbSepolia: getNetwork2("https://arbitrum-sepolia.infura.io/v3/" + process.env.INFURA_API_KEY),
    odyssey: getNetwork2("https://odyssey.ithaca.xyz"),
    monadtest: getNetwork2("https://testnet-rpc.monad.xyz"),
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

    // ethmain2: getNetworkProd("https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    // opmain2: getNetworkProd("https://optimism-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    // arbmain2: getNetworkProd("https://arbitrum-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    // // polymain2: getNetwork1("https://polygon-mainnet.infura.io/v3/16fb3743839e4f80841b0401a68a020f"),
    // basemain2: getNetworkProd("https://1rpc.io/base"),
    // avaxmain2: getNetworkProd("https://avalanche-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),



    opMaster: getNetworkMaster("https://optimism-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    arbMaster: getNetworkMaster("https://arbitrum-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    baseMaster: getNetworkMaster("https://1rpc.io/base"),

    // opRegDeployment: getNetworkReg("https://optimism-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    // arbRegDeployment: getNetworkReg("https://arbitrum-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY),
    // baseRegDeployment: getNetworkReg("https://1rpc.io/base"),
  
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
      odyssey: 'empty'
    },
    customChains: [
      {
        network: "odyssey",
        chainId: 911867,
        urls: {
          apiURL: "https://explorer-odyssey.t.conduit.xyz/api",
          browserURL: "https://explorer-odyssey.t.conduit.xyz:443"
        }
      },
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
  },
  paths: {
    sources: "./contracts",
  },
};

export default config;
