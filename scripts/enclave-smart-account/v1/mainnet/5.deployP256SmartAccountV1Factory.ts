import { ethers } from "hardhat";
import { mainnetSlugs } from "../../../../config/networks";
import { RPC } from "../../../../config/rpcNodes";
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
    console.log('PRIVATE_KEY_MASTER:', process.env.P256_ACCOUNT_DEPLOYMENT_KEY ?? 'Not set');

    for (let i = 0; i < mainnetSlugs.length; i++) {
        const ACTIVE_SLUG = mainnetSlugs[i];
        const wallet = new ethers.Wallet(process.env.P256_ACCOUNT_DEPLOYMENT_KEY as string, new JsonRpcProvider(RPC[ACTIVE_SLUG]));

        console.log(`Deploying P256SmartAccountFactoryV1 with account: ${wallet.address} on network ${ACTIVE_SLUG}`);

        // Deploy P256SmartAccountFactoryV1
        const P256SmartAccountFactoryV1 = await ethers.getContractFactory("P256SmartAccountFactoryV1");
        const p256SmartAccountFactoryV1 = await P256SmartAccountFactoryV1.connect(wallet).deploy();
        await p256SmartAccountFactoryV1.waitForDeployment();

        const p256SmartAccountFactoryV1Address = await p256SmartAccountFactoryV1.getAddress();
        console.log(`P256SmartAccountFactoryV1 deployed to: ${p256SmartAccountFactoryV1Address} on network ${ACTIVE_SLUG}`);

        // Update deployment data with new address
        (deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).p256SmartAccountFactoryV1 = p256SmartAccountFactoryV1Address;
        
        console.log(`Updated deployment data for network ${ACTIVE_SLUG}`);
    }

    console.log("Deployment data updated successfully");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
