import { ethers } from "hardhat";
import {mainnetSlugs} from "../../../../config/networks";
import {RPC} from "../../../../config/rpcNodes";
import * as dotenv from 'dotenv';
import { JsonRpcProvider } from "ethers";

// Load environment variables
const env = dotenv.config();
if (env.error) {
    throw new Error('Error loading .env file');
}

// Validate required environment variables
const requiredEnvVars = ['INFURA_API_KEY', 'REGISTRY_DEPLOYMENT_KEY_NEW'];
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
    console.log('REGISTRY_DEPLOYMENT_KEY:', process.env.REGISTRY_DEPLOYMENT_KEY_NEW ?? 'Not set');

    for (let i = 0; i < mainnetSlugs.length; i++) {
        const ACTIVE_SLUG = mainnetSlugs[i];

        const wallet = new ethers.Wallet(process.env.REGISTRY_DEPLOYMENT_KEY_NEW as string, new JsonRpcProvider(RPC[ACTIVE_SLUG]));

        console.log("Deploying contracts with account:", wallet.address);

        const admin = "0xF1Fb9a6A3436FEB0af1De39f17c7b46cf5526957";

        // Deploy EnclaveRegistryV0
        const EnclaveRegistryV0 = await ethers.getContractFactory("EnclaveRegistryV0");
        const enclaveRegistry = await EnclaveRegistryV0.connect(wallet).deploy(admin);
        await enclaveRegistry.waitForDeployment();
        
        const registryAddress = await enclaveRegistry.getAddress();
        console.log("EnclaveRegistryV0 deployed to:", registryAddress, "on network", ACTIVE_SLUG);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
