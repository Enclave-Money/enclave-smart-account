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
const requiredEnvVars = ['INFURA_API_KEY', 'SMART_ACCOUNT_DEPLOYMENT_KEY'];
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
    console.log('SMART_ACCOUNT_DEPLOYMENT_KEY:', process.env.SMART_ACCOUNT_DEPLOYMENT_KEY ?? 'Not set');

    for (let i = 0; i < mainnetSlugs.length; i++) {
        const ACTIVE_SLUG = mainnetSlugs[i];
        const wallet = new ethers.Wallet(process.env.SMART_ACCOUNT_DEPLOYMENT_KEY as string, new JsonRpcProvider(RPC[ACTIVE_SLUG]));

        console.log(`Deploying SmartAccountFactoryV1 with account: ${wallet.address} on network ${ACTIVE_SLUG}`);
        
        // Deploy SmartAccountFactoryV1
        const SmartAccountFactoryV1 = await ethers.getContractFactory("SmartAccountFactoryV1");
        const accountFactory = await SmartAccountFactoryV1.connect(wallet).deploy();
        await accountFactory.waitForDeployment();
        
        const accountFactoryAddress = await accountFactory.getAddress();
        console.log(`SmartAccountFactoryV1 deployed to: ${accountFactoryAddress}`);
       
        // Update deployment data with new address
        (deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).accountFactories.smartAccountFactoryV1 = accountFactoryAddress;
        
        console.log(`Updated deployment data for network ${ACTIVE_SLUG}`);
        console.log(`Account Factory: ${(deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).accountFactory}`);
    }
    
    console.log("Deployment data updated successfully");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 