import { ethers } from "hardhat";
import {ARB_MAIN_SLUG, OP_MAIN_SLUG, BASE_MAIN_SLUG, mainnetSlugs} from "../../../../config/networks";
import {RPC} from "../../../../config/rpcNodes";
import * as dotenv from 'dotenv';
import { JsonRpcProvider } from "ethers";
import deploymentData from "../../../../config/mainnetDeploymentContracts.json";
import { EnclaveModuleManager } from "../../../../typechain-types";

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

        console.log(`Deploying SmartAccountECDSAValidator with account: ${wallet.address} on network ${ACTIVE_SLUG}`);
                
        // Deploy SmartAccountECDSAValidator
        const SmartAccountECDSAValidator = await ethers.getContractFactory("SmartAccountECDSAValidator");
        const ecdsaValidator = await SmartAccountECDSAValidator.connect(wallet).deploy();
        await ecdsaValidator.waitForDeployment();
        
        const ecdsaValidatorAddress = await ecdsaValidator.getAddress();
        console.log(`SmartAccountECDSAValidator deployed to: ${ecdsaValidatorAddress}`);
        
        // Update deployment data with new address
        (deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).accountModules.ecdsaValidator = ecdsaValidatorAddress;
        
        console.log(`Updated deployment data for network ${ACTIVE_SLUG}`);
        console.log((deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).accountModules);

        console.log(`Enabling ECDSA validator module with account: ${wallet.address} on network ${ACTIVE_SLUG}`);

        const networkData = deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData];
        const moduleManagerAddress = networkData.moduleManager;

        if (!moduleManagerAddress) {
            console.log(`Missing ModuleManager address for network ${ACTIVE_SLUG}. Skipping enablement...`);
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
    
    console.log("Deployment data updated successfully");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 