export const RPC = {
    10: "https://optimism-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
    42161: "https://arbitrum-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
    8453: "https://1rpc.io/base",
} as {[key: number]: string}