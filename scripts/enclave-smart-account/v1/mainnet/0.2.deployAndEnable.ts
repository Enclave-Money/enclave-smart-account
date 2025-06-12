import { ethers } from "hardhat";
import { mainnetSlugs } from "../../../../config/networks";
import { RPC } from "../../../../config/rpcNodes";
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

        console.log(`\n🚀 Starting LimitOrderSessionValidator deployment and enabling for network ${ACTIVE_SLUG}`);
        console.log(`Using wallet: ${wallet.address}`);

        const networkData = deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData];
        if (!networkData) {
            console.log(`❌ No deployment data found for network ${ACTIVE_SLUG}. Skipping...`);
            continue;
        }

        const moduleManagerAddress = networkData.moduleManager;
        const registryAddress = networkData.registry;

        if (!moduleManagerAddress || !registryAddress) {
            console.log(`❌ Missing required addresses for network ${ACTIVE_SLUG}. Skipping...`);
            continue;
        }

        console.log(`Using ModuleManager at: ${moduleManagerAddress}`);
        console.log(`Using Registry at: ${registryAddress}`);

        // Check if LimitOrderSessionValidator is already deployed
        const existingLimitOrderValidator = networkData.accountModules?.limitOrderSessionValidator;
        let limitOrderSessionValidatorAddress = existingLimitOrderValidator;

        // Deploy LimitOrderSessionValidator
        console.log(`\n📦 Deploying LimitOrderSessionValidator...`);
        
        try {
            const LimitOrderSessionValidator = await ethers.getContractFactory("LimitOrderSessionValidator");
            const limitOrderSessionValidator = await LimitOrderSessionValidator.connect(wallet).deploy(registryAddress);
            await limitOrderSessionValidator.waitForDeployment();
            
            limitOrderSessionValidatorAddress = await limitOrderSessionValidator.getAddress();
            console.log(`✅ LimitOrderSessionValidator deployed to: ${limitOrderSessionValidatorAddress}`);

            // Update deployment data
            if (!networkData.accountModules) {
                (networkData as any).accountModules = {};
            }
            (networkData as any).accountModules.limitOrderSessionValidator = limitOrderSessionValidatorAddress;
            
            console.log(`📝 Updated deployment data for network ${ACTIVE_SLUG}`);
        } catch (error) {
            console.error(`❌ Failed to deploy LimitOrderSessionValidator on network ${ACTIVE_SLUG}:`, error);
            continue;
        }
        

        // Enable LimitOrderSessionValidator in ModuleManager
        console.log(`\n🔧 Enabling LimitOrderSessionValidator in ModuleManager...`);
        
        try {
            const ModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
            const moduleManager = ModuleManager.attach(moduleManagerAddress).connect(wallet) as EnclaveModuleManager;

            // Check if module is already enabled
            const isEnabled = await moduleManager.isModuleEnabled(limitOrderSessionValidatorAddress);
            
            if (isEnabled) {
                console.log(`✅ LimitOrderSessionValidator is already enabled in ModuleManager`);
            } else {
                console.log(`Enabling LimitOrderSessionValidator...`);
                const enableTx = await moduleManager.enableModule(limitOrderSessionValidatorAddress);
                await enableTx.wait();
                console.log(`✅ LimitOrderSessionValidator enabled successfully`);
                console.log(`Transaction hash: ${enableTx.hash}`);
            }
        } catch (error) {
            console.error(`❌ Failed to enable LimitOrderSessionValidator on network ${ACTIVE_SLUG}:`, error);
            continue;
        }

        console.log(`\n🎉 Successfully completed deployment and enabling for network ${ACTIVE_SLUG}`);
        console.log(`LimitOrderSessionValidator Address: ${limitOrderSessionValidatorAddress}`);
    }

    console.log("\n✅ All networks processed successfully!");
}

main()
    .then(() => {
        console.log("\n🎉 Script completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
