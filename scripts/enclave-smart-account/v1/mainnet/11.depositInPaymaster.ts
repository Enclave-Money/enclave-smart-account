import { ethers } from "hardhat";
import { mainnetSlugs } from "../../../../config/networks";
import { RPC } from "../../../../config/rpcNodes";
import * as dotenv from 'dotenv';
import { JsonRpcProvider, Wallet } from "ethers";
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

// Configuration: Deposit amounts for each network (in ETH)
const DEPOSIT_AMOUNTS: { [key: number]: bigint } = {
    1: ethers.parseEther("0.015"),      // Ethereum Mainnet
    56: ethers.parseEther("0.01"),     // BSC
    137: ethers.parseEther("25"),      // Polygon
    43114: ethers.parseEther("0.9"),   // Avalanche
    146: ethers.parseEther("10"),      // Sonic
    130: ethers.parseEther("0.1"),     // Unichain
    42161: ethers.parseEther("0.001"),  // Arbitrum
    10: ethers.parseEther("0.01"),     // Optimism
    8453: ethers.parseEther("0.0004"),   // Base
};

// Contract types for different paymaster implementations
const PAYMASTER_CONTRACTS = {
    EnclaveVerifyingPaymaster: "EnclaveVerifyingPaymaster"
};

// You can specify which networks to process, or leave empty to process all available networks
const NETWORKS_TO_PROCESS: number[] = [42161, 8453]; // Example: only process Polygon. Leave empty [] to process all.

async function depositInPaymaster(
    networkSlug: number,
    paymasterAddress: string,
    depositAmount: bigint,
    wallet: Wallet,
    contractType: string = PAYMASTER_CONTRACTS.EnclaveVerifyingPaymaster
) {
    console.log(`\n=== Depositing in Paymaster on Network ${networkSlug} ===`);
    console.log(`Paymaster Address: ${paymasterAddress}`);
    console.log(`Deposit Amount: ${ethers.formatEther(depositAmount)} ETH`);
    console.log(`Using Account: ${wallet.address}`);

    try {
        // Create contract instance
        const paymasterFactory = await ethers.getContractFactory(contractType);
        const paymaster = paymasterFactory.attach(paymasterAddress).connect(wallet);

        // Check current balance before deposit
        const balanceBefore = await paymaster.getDeposit();
        console.log(`Current paymaster balance: ${ethers.formatEther(balanceBefore)} ETH`);

        // Deposit funds
        console.log('Initiating deposit transaction...');
        const depositTx = await paymaster.deposit({ value: depositAmount });
        
        console.log(`Transaction hash: ${depositTx.hash}`);
        console.log('Waiting for transaction confirmation...');
        
        const receipt = await depositTx.wait();
        console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

        // Check new balance after deposit
        const balanceAfter = await paymaster.getDeposit();
        console.log(`New paymaster balance: ${ethers.formatEther(balanceAfter)} ETH`);
        console.log(`Successfully deposited ${ethers.formatEther(depositAmount)} ETH`);

        return {
            success: true,
            txHash: depositTx.hash,
            balanceBefore: ethers.formatEther(balanceBefore),
            balanceAfter: ethers.formatEther(balanceAfter),
        };
    } catch (error) {
        console.error(`Error depositing in paymaster on network ${networkSlug}:`, error);
        return {
            success: false,
            error: error.message,
        };
    }
}

async function main() {
    const results: any[] = [];

    // Get networks to process
    const networksToProcess = NETWORKS_TO_PROCESS.length > 0 
        ? NETWORKS_TO_PROCESS 
        : mainnetSlugs;

    console.log('=== Paymaster Deposit Script ===');
    console.log(`Networks to process: ${networksToProcess.join(', ')}`);

    for (const networkSlug of networksToProcess) {
        try {
            // Create wallet for this network
            const wallet = new ethers.Wallet(
                process.env.PRIVATE_KEY_MASTER as string, 
                new JsonRpcProvider(RPC[networkSlug])
            );

            // Get deployment data for this network
            const networkData = deploymentData[networkSlug.toString() as keyof typeof deploymentData] as any;
            
            if (!networkData) {
                console.log(`\n⚠️  No deployment data found for network ${networkSlug}, skipping...`);
                continue;
            }

            // Get paymaster address
            const paymasterAddress = networkData.paymasters?.enclaveVerifyingPaymaster;
            
            if (!paymasterAddress) {
                console.log(`\n⚠️  No paymaster address found for network ${networkSlug}, skipping...`);
                continue;
            }

            // Get deposit amount for this network
            const depositAmount = DEPOSIT_AMOUNTS[networkSlug];
            
            if (!depositAmount) {
                console.log(`\n⚠️  No deposit amount configured for network ${networkSlug}, skipping...`);
                continue;
            }

            // Deposit in paymaster
            const result = await depositInPaymaster(
                networkSlug,
                paymasterAddress,
                depositAmount,
                wallet
            );

            results.push({
                network: networkSlug,
                paymasterAddress,
                ...result,
            });

            // Wait a bit between networks to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error: any) {
            console.error(`Error processing network ${networkSlug}:`, error);
            results.push({
                network: networkSlug,
                success: false,
                error: error.message,
            });
        }
    }

    // Print summary
    console.log('\n=== Deposit Summary ===');
    results.forEach(result => {
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        console.log(`Network ${result.network}: ${status}`);
        if (result.success) {
            console.log(`  - Transaction: ${result.txHash}`);
            console.log(`  - Balance before: ${result.balanceBefore} ETH`);
            console.log(`  - Balance after: ${result.balanceAfter} ETH`);
        } else {
            console.log(`  - Error: ${result.error}`);
        }
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n📊 Summary: ${successCount}/${results.length} deposits successful`);
}

// Execute the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
