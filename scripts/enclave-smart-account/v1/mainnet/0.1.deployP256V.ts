import { ethers } from "hardhat";
import { mainnetSlugs} from "../../../../config/networks";
import {RPC} from "../../../../config/rpcNodes";
import * as dotenv from 'dotenv';
import { JsonRpcProvider } from "ethers";

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

        console.log(`\n========================================`);
        console.log(`Deploying P256Verifier on network: ${ACTIVE_SLUG}`);
        console.log(`Deployer address: ${wallet.address}`);
        console.log(`========================================`);

        try {
            // Deploy P256Verifier
            console.log(`📦 Deploying P256Verifier...`);
            const p256VerifierFactory = await ethers.getContractFactory("P256Verifier");
            const p256Verifier = await p256VerifierFactory.connect(wallet).deploy();
            
            console.log(`⏳ Waiting for deployment confirmation...`);
            await p256Verifier.waitForDeployment();
            
            const p256VerifierAddress = await p256Verifier.getAddress();
            console.log(`✅ P256Verifier deployed successfully!`);
            console.log(`📍 Address: ${p256VerifierAddress}`);
            
            // Get deployment transaction details
            const deploymentTx = p256Verifier.deploymentTransaction();
            if (deploymentTx) {
                console.log(`🔗 Transaction hash: ${deploymentTx.hash}`);
                console.log(`⛽ Gas used: ${deploymentTx.gasLimit}`);
                console.log(`💰 Gas price: ${deploymentTx.gasPrice ? ethers.formatUnits(deploymentTx.gasPrice, 'gwei') : 'N/A'} gwei`);
            }
        } catch (error) {
            console.error(`❌ Deployment failed on network ${ACTIVE_SLUG}:`, error);
            continue;
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Deployment script failed:', error);
        process.exit(1);
    });
