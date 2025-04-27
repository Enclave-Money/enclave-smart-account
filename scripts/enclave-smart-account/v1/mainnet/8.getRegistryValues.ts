import { ethers } from "hardhat";
import { mainnetSlugs } from "../../../../config/networks";
import { RPC } from "../../../../config/rpcNodes";
import * as dotenv from 'dotenv';
import { JsonRpcProvider } from "ethers";
import deploymentData from "../../../../config/mainnetDeploymentContracts.json";
import { EnclaveRegistryV0 } from "../../../../typechain-types";

// Load environment variables
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

async function main() {
    // Constants for registry keys
    const SMART_BALANCE_CONVERSION_MANAGER = ethers.keccak256(ethers.toUtf8Bytes("smartBalanceConversionManager"));
    const ENTRYPOINT = ethers.keccak256(ethers.toUtf8Bytes("entryPoint"));
    const MODULE_MANAGER = ethers.keccak256(ethers.toUtf8Bytes("moduleManager"));
    const SMART_BALANCE_VAULT = ethers.keccak256(ethers.toUtf8Bytes("smartBalanceVault"));

    for (const networkSlug of mainnetSlugs) {
        console.log(`\nFetching registry values for network: ${networkSlug}`);
        
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[networkSlug]));
        const networkData = deploymentData[networkSlug.toString() as keyof typeof deploymentData];
        const registryAddress = networkData.registry;

        console.log(`Using Registry at: ${registryAddress}`);
        console.log(`Current wallet address: ${wallet.address}`);

        // Get the registry contract
        const Registry = await ethers.getContractFactory("EnclaveRegistryV0");
        const registry = Registry.attach(registryAddress).connect(wallet) as EnclaveRegistryV0;

        // Check admin and manager roles
        const isManager = await registry.isManager(wallet.address);
        
        console.log("\nRole Checks:");
        console.log("Is Manager:", isManager);

        // Fetch all registry values
        const values = await Promise.all([
            registry.getRegistryAddress(SMART_BALANCE_CONVERSION_MANAGER),
            registry.getRegistryAddress(ENTRYPOINT),
            registry.getRegistryAddress(MODULE_MANAGER),
            registry.getRegistryAddress(SMART_BALANCE_VAULT)
        ]);

        // Log the results
        console.log("\nRegistry Values:");
        console.log("Smart Balance Conversion Manager:", values[0]);
        console.log("EntryPoint:", values[1]);
        console.log("Module Manager:", values[2]);
        console.log("Smart Balance Vault:", values[3]);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
