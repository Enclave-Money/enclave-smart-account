import { ethers } from "hardhat";
import {ARB_MAIN_SLUG, OP_MAIN_SLUG, BASE_MAIN_SLUG, mainnetSlugs} from "../../../../config/networks";
import {RPC} from "../../../../config/rpcNodes";
import * as dotenv from 'dotenv';
import { JsonRpcProvider } from "ethers";
import { EnclaveModuleManager } from "../../../../typechain-types";
import deploymentData from "../../../../config/mainnetDeploymentContracts.json";

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

    for (let i = 0; i < mainnetSlugs.length; i++) {
        const ACTIVE_SLUG = mainnetSlugs[i];
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[ACTIVE_SLUG]));

        console.log(`Enabling ECDSA validator module with account: ${wallet.address} on network ${ACTIVE_SLUG}`);

        const networkData = deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData];
        const moduleManagerAddress = networkData.moduleManager;
        
        // Get module address safely using type assertion
        const accountModules = (networkData as any).accountModules || {};
        const ecdsaValidatorAddress = accountModules.ecdsaValidator;
        
        if (!ecdsaValidatorAddress) {
            console.log(`Missing ECDSA validator address for network ${ACTIVE_SLUG}. Skipping...`);
            continue;
        }

        console.log(`Using ModuleManager at: ${moduleManagerAddress}`);
        console.log(`SmartAccountECDSAValidator: ${ecdsaValidatorAddress}`);

        // Get the module manager contract
        const ModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
        const moduleManager = ModuleManager.attach(moduleManagerAddress).connect(wallet) as EnclaveModuleManager;

        // Enable the ECDSA validator module in the module manager
        console.log("Enabling SmartAccountECDSAValidator...");
        const tx = await moduleManager.enableModule(ecdsaValidatorAddress);
        await tx.wait();
        console.log("SmartAccountECDSAValidator enabled successfully");

        console.log(`ECDSA Validator module enabled for network ${ACTIVE_SLUG}`);
    }

    console.log("ECDSA Validator module enabled successfully across all networks");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 