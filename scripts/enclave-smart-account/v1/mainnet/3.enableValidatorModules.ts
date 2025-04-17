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

        console.log(`Enabling validator modules with account: ${wallet.address} on network ${ACTIVE_SLUG}`);

        const networkData = deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData];
        const moduleManagerAddress = networkData.moduleManager;
        
        // Get module addresses
        const p256ValidatorAddress = networkData.accountModules.p256Validator;
        const smartBalanceKeyValidatorAddress = networkData.accountModules.smartBalanceKeyValidator;
        const simpleSessionKeyValidatorAddress = networkData.accountModules.simpleSessionKeyValidator;
        
        if (!p256ValidatorAddress || !smartBalanceKeyValidatorAddress || !simpleSessionKeyValidatorAddress) {
            console.log(`Missing module addresses for network ${ACTIVE_SLUG}. Skipping...`);
            continue;
        }

        console.log(`Using ModuleManager at: ${moduleManagerAddress}`);
        console.log(`P256Validator: ${p256ValidatorAddress}`);
        console.log(`SmartBalanceKeyValidator: ${smartBalanceKeyValidatorAddress}`);
        console.log(`SimpleSessionKeyValidator: ${simpleSessionKeyValidatorAddress}`);

        // Get the module manager contract
        const ModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
        const moduleManager = ModuleManager.attach(moduleManagerAddress).connect(wallet) as EnclaveModuleManager;

        // Enable all modules in the module manager
        console.log("Enabling P256Validator...");
        const tx1 = await moduleManager.enableModule(p256ValidatorAddress);
        await tx1.wait();
        console.log("P256Validator enabled successfully");

        console.log("Enabling SmartBalanceKeyValidator...");
        const tx2 = await moduleManager.enableModule(smartBalanceKeyValidatorAddress);
        await tx2.wait();
        console.log("SmartBalanceKeyValidator enabled successfully");

        console.log("Enabling SimpleSessionKeyValidator...");
        const tx3 = await moduleManager.enableModule(simpleSessionKeyValidatorAddress);
        await tx3.wait();
        console.log("SimpleSessionKeyValidator enabled successfully");

        console.log(`All modules enabled for network ${ACTIVE_SLUG}`);
    }

    console.log("All modules enabled successfully across all networks");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 