import { ethers } from "hardhat";
import {mainnetSlugs} from "../../../../config/networks";
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

const DEPOSIT_AMOUNT: {[key: number]: bigint} = {
    56: ethers.parseEther("0.009"),
    137: ethers.parseEther("23"),
    // 43114: ethers.parseEther("0.2"),
    // 146: ethers.parseEther("10"),
}

async function main() {
    const [deployer] = await ethers.getSigners();

    // Debug log for environment variables
    console.log('Environment variables loaded:');
    console.log('INFURA_API_KEY:', process.env.INFURA_API_KEY ?? 'Not set');
    console.log('PRIVATE_KEY_MASTER:', process.env.PRIVATE_KEY_MASTER ?? 'Not set');
    // Parse deposit amount
    

    for (let i = 0; i < mainnetSlugs.length; i++) {
        const ACTIVE_SLUG = mainnetSlugs[i];
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[ACTIVE_SLUG]));

        console.log(`\n=== Deploying on Network ${ACTIVE_SLUG} ===`);
        console.log(`Deploying EnclaveVerifyingPaymaster with account: ${wallet.address}`);

        const depositAmount = DEPOSIT_AMOUNT[ACTIVE_SLUG];
        console.log(`Deposit amount: ${ethers.formatEther(depositAmount)} ETH`);
        
        // // Get EntryPoint address from deployment data
        const entryPointAddress = (deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).entrypoint;
        const verifyingSignerAddress = wallet.address;
        
        if (!entryPointAddress) {
            throw new Error(`EntryPoint address not found for network ${ACTIVE_SLUG}`);
        }
        
        console.log(`Using EntryPoint: ${entryPointAddress}`);
        console.log(`Using Verifying Signer: ${verifyingSignerAddress}`);
        
        // Deploy EnclaveVerifyingPaymaster
        const EnclaveVerifyingPaymaster = await ethers.getContractFactory("EnclaveVerifyingPaymaster");
        const verifyingPaymaster = await EnclaveVerifyingPaymaster.connect(wallet).deploy(
            entryPointAddress,
            verifyingSignerAddress
        );
        await verifyingPaymaster.waitForDeployment();
        
        const verifyingPaymasterAddress = await verifyingPaymaster.getAddress();
        console.log(`EnclaveVerifyingPaymaster deployed to: ${verifyingPaymasterAddress}`);

        // Wait for 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Deposit ETH into the paymaster
        console.log(`Depositing ${ethers.formatEther(depositAmount)} ETH into paymaster...`);
        const depositTx = await verifyingPaymaster.connect(wallet).deposit({ value: depositAmount });
        await depositTx.wait();
        console.log(`Successfully deposited ${ethers.formatEther(depositAmount)} ETH`);
        
        // Check the deposit balance
        const balance = await verifyingPaymaster.getDeposit();
        console.log(`Paymaster deposit balance: ${ethers.formatEther(balance)} ETH`);
        
        // Update deployment data with new address
        if (!(deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).paymasters) {
            (deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).paymasters = {};
        }
        (deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).paymasters.enclaveVerifyingPaymaster = verifyingPaymasterAddress;
        
        console.log(`Updated deployment data for network ${ACTIVE_SLUG}`);
        console.log(`Verifying Paymaster: ${(deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).paymasters.enclaveVerifyingPaymaster}`);
    }
    
    console.log("\n=== Deployment Summary ===");
    console.log("Deployment completed successfully");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
