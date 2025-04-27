import { ethers } from "hardhat";
import { mainnetSlugs } from "../../../../config/networks";
import { RPC } from "../../../../config/rpcNodes";
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

        console.log(`Deploying MultichainP256Validator with account: ${wallet.address} on network ${ACTIVE_SLUG}`);

        const networkData = deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData];
        const moduleManagerAddress = networkData.moduleManager;
        const p256PrecompileAddress = networkData.precompile.p256Verifier;

        if (!moduleManagerAddress || !p256PrecompileAddress) {
            console.log(`Missing required addresses for network ${ACTIVE_SLUG}. Skipping...`);
            continue;
        }

        console.log(`Using ModuleManager at: ${moduleManagerAddress}`);
        console.log(`Using P256Precompile at: ${p256PrecompileAddress}`);

        // Deploy MultichainP256Validator
        const MultichainP256Validator = await ethers.getContractFactory("MultichainP256Validator");
        const multichainP256Validator = await MultichainP256Validator.connect(wallet).deploy(moduleManagerAddress, p256PrecompileAddress);
        await multichainP256Validator.waitForDeployment();
        
        const multichainP256ValidatorAddress = await multichainP256Validator.getAddress();
        console.log(`MultichainP256Validator deployed to: ${multichainP256ValidatorAddress}`);
        
        // Update deployment data with new address
        (deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).accountModules.multichainP256Validator = multichainP256ValidatorAddress;
        
        console.log(`Updated deployment data for network ${ACTIVE_SLUG}`);
        console.log((deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).accountModules);

        console.log(`Enabling MultichainP256Validator module with account: ${wallet.address} on network ${ACTIVE_SLUG}`);

        // Get the module manager contract
        const ModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
        const moduleManager = ModuleManager.attach(moduleManagerAddress).connect(wallet) as EnclaveModuleManager;

        // Enable the MultichainP256Validator module in the module manager
        console.log("Enabling MultichainP256Validator...");
        const tx = await moduleManager.enableModule(multichainP256ValidatorAddress);
        await tx.wait();
        console.log("MultichainP256Validator enabled successfully");

        console.log(`MultichainP256Validator module enabled for network ${ACTIVE_SLUG}`);
    }
    
    console.log("Deployment data updated successfully");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 