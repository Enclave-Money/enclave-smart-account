export const RPC = {
    10: "https://optimism-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
    42161: "https://arbitrum-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
    8453: "https://1rpc.io/base",
    1: "https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
    130: "https://unichain-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,

    56: "https://bsc-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
    137: "https://polygon-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
    43114: "https://avalanche-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
    146: "https://sonic-mainnet.core.chainstack.com/" + process.env.CHAINSTACK_SONIC_API_KEY,
} as {[key: number]: string}