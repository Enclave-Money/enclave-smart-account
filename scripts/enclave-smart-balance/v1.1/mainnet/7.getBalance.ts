import { ethers } from "hardhat";
import * as mainnetContracts from "../../../../config/mainnetDeploymentContracts.json";
import { EnclaveVirtualLiquidityVault, ERC20 } from "../../../../typechain-types";
import * as dotenv from 'dotenv';
import { ARB_MAIN_SLUG } from "../../../../config/networks";
import { JsonRpcProvider } from "ethers";
import { RPC } from "../../../../config/rpcNodes";

const env = dotenv.config();
if (env.error) {
    throw new Error('Error loading .env file');
}

// Validate required environment variables
const requiredEnvVars = ['INFURA_API_KEY', 'PRIVATE_KEY_MASTER'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// USDC address on Arbitrum
const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
    const walletArb = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[ARB_MAIN_SLUG]));
    
    console.log("Using account:", walletArb.address);

    // Get contract factories
    const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");

    // Attach contracts
    const vaultArb = VaultFactory.attach(mainnetContracts[ARB_MAIN_SLUG].vault).connect(walletArb) as unknown as EnclaveVirtualLiquidityVault;

    // Get user's deposit balance in the vault
    const userDepositBalance = await vaultArb.deposits(ARBITRUM_USDC, walletArb.address);
    console.log("User's deposit balance in vault:", ethers.formatUnits(userDepositBalance, 6));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
