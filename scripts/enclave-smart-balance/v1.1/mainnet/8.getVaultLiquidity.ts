import { ethers } from "hardhat";
import * as mainnetContracts from "../../../../config/mainnetDeploymentContracts.json";
import { EnclaveVirtualLiquidityVault } from "../../../../typechain-types";
import * as dotenv from 'dotenv';
import { ARB_MAIN_SLUG, BASE_MAIN_SLUG, OP_MAIN_SLUG } from "../../../../config/networks";
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

// USDC addresses for different chains
const USDC_ADDRESSES = {
    [OP_MAIN_SLUG]: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",    // Optimism
    [ARB_MAIN_SLUG]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
    [BASE_MAIN_SLUG]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"   // Base
};

async function main() {
    console.log("Checking USDC vault liquidity across all chains...\n");

    // Create wallets for each chain
    const walletArb = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[ARB_MAIN_SLUG]));
    const walletBase = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[BASE_MAIN_SLUG]));
    const walletOp = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[OP_MAIN_SLUG]));

    // Get contract factory
    const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");

    // Attach vault contracts for each chain
    const vaultArb = VaultFactory.attach(mainnetContracts[ARB_MAIN_SLUG].vault).connect(walletArb) as unknown as EnclaveVirtualLiquidityVault;
    const vaultBase = VaultFactory.attach(mainnetContracts[BASE_MAIN_SLUG].vault).connect(walletBase) as unknown as EnclaveVirtualLiquidityVault;
    const vaultOp = VaultFactory.attach(mainnetContracts[OP_MAIN_SLUG].vault).connect(walletOp) as unknown as EnclaveVirtualLiquidityVault;

    // Get liquidity for each chain
    const [liquidityArb, liquidityBase, liquidityOp] = await Promise.all([
        vaultArb.getVaultLiquidity(USDC_ADDRESSES[ARB_MAIN_SLUG]),
        vaultBase.getVaultLiquidity(USDC_ADDRESSES[BASE_MAIN_SLUG]),
        vaultOp.getVaultLiquidity(USDC_ADDRESSES[OP_MAIN_SLUG])
    ]);

    // Print results
    console.log("USDC Vault Liquidity:");
    console.log("---------------------");
    console.log(`Arbitrum: ${ethers.formatUnits(liquidityArb, 6)} USDC`);
    console.log(`Base: ${ethers.formatUnits(liquidityBase, 6)} USDC`);
    console.log(`Optimism: ${ethers.formatUnits(liquidityOp, 6)} USDC`);
    console.log("---------------------");
    console.log(`Total: ${ethers.formatUnits(liquidityArb + liquidityBase + liquidityOp, 6)} USDC`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
