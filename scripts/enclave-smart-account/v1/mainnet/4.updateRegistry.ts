import { ethers } from "hardhat";
import { mainnetSlugs} from "../../../../config/networks";
import {RPC} from "../../../../config/rpcNodes";
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
    const [deployer] = await ethers.getSigners();

    // Debug log for environment variables
    console.log('Environment variables loaded:');
    console.log('INFURA_API_KEY:', process.env.INFURA_API_KEY ?? 'Not set');
    console.log('PRIVATE_KEY_MASTER:', process.env.PRIVATE_KEY_MASTER ?? 'Not set');

    // Constants
    const SMART_BALANCE_CONVERSION_MANAGER = ethers.keccak256(ethers.toUtf8Bytes("smartBalanceConversionManager"));
    const ENTRYPOINT = ethers.keccak256(ethers.toUtf8Bytes("entryPoint"));
    const MODULE_MANAGER = ethers.keccak256(ethers.toUtf8Bytes("moduleManager"));
    const SMART_BALANCE_VAULT = ethers.keccak256(ethers.toUtf8Bytes("smartBalanceVault"));

    for (let i = 0; i < mainnetSlugs.length; i++) {
        const ACTIVE_SLUG = mainnetSlugs[i];
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[ACTIVE_SLUG]));

        console.log(`Updating registry with account: ${wallet.address} on network ${ACTIVE_SLUG}`);

        const networkData = deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData];
        const registryAddress = networkData.registry;
        
        // Get module addresses
        const p256ValidatorAddress = networkData.accountModules.p256Validator;
        const smartBalanceKeyValidatorAddress = networkData.accountModules.smartBalanceKeyValidator;
        const simpleSessionKeyValidatorAddress = networkData.accountModules.simpleSessionKeyValidator;
        
        if (!p256ValidatorAddress || !smartBalanceKeyValidatorAddress || !simpleSessionKeyValidatorAddress) {
            console.log(`Missing module addresses for network ${ACTIVE_SLUG}. Skipping...`);
            continue;
        }

        console.log(`Using Registry at: ${registryAddress}`);

        // Get the registry contract
        const Registry = await ethers.getContractFactory("EnclaveRegistryV0");
        const registry = Registry.attach(registryAddress).connect(wallet) as EnclaveRegistryV0;

        // Update registry with smart balance conversion manager
        console.log("Setting smart balance conversion manager in registry...");
        const tx1 = await registry.updateRegistryAddress(SMART_BALANCE_CONVERSION_MANAGER, wallet.address);
        await tx1.wait();
        console.log(`Smart balance conversion manager set to: ${wallet.address}`);

        // Update registry with entrypoint
        console.log("Setting entrypoint in registry...");
        const tx2 = await registry.updateRegistryAddress(ENTRYPOINT, networkData.entrypoint);
        await tx2.wait();
        console.log(`Entrypoint set to: ${networkData.entrypoint}`);

        // Update registry with module manager
        console.log("Setting module manager in registry...");
        const tx3 = await registry.updateRegistryAddress(MODULE_MANAGER, networkData.moduleManager);
        await tx3.wait();
        console.log(`Module manager set to: ${networkData.moduleManager}`);

        // Update registry with smart balance vault
        // console.log("Setting smart balance vault in registry...");
        // const tx4 = await registry.updateRegistryAddress(SMART_BALANCE_VAULT, networkData.vault);
        // await tx4.wait();
        // console.log(`Smart balance vault set to: ${networkData.vault}`);           
        
        console.log(`Registry updated for network ${ACTIVE_SLUG}`);
    }

    console.log("Registry updated successfully across all networks");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 