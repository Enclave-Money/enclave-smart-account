import { ethers } from "hardhat";
import {ARB_MAIN_SLUG, OP_MAIN_SLUG, BASE_MAIN_SLUG, mainnetSlugs} from "../../../../config/networks";
import {RPC} from "../../../../config/rpcNodes";
import * as dotenv from 'dotenv';
import { JsonRpcProvider } from "ethers";
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

        console.log(`Deploying SmartAccountECDSAValidator with account: ${wallet.address} on network ${ACTIVE_SLUG}`);
                
        // Deploy SmartAccountECDSAValidator
        const SmartAccountECDSAValidator = await ethers.getContractFactory("SmartAccountECDSAValidator");
        const ecdsaValidator = await SmartAccountECDSAValidator.connect(wallet).deploy();
        await ecdsaValidator.waitForDeployment();
        
        const ecdsaValidatorAddress = await ecdsaValidator.getAddress();
        console.log(`SmartAccountECDSAValidator deployed to: ${ecdsaValidatorAddress}`);
        
        (deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).accountModules.ecdsaValidator = ecdsaValidatorAddress;
        
        console.log(`Updated deployment data for network ${ACTIVE_SLUG}`);
        console.log((deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).accountModules);
    }
    
    console.log("Deployment data updated successfully");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 