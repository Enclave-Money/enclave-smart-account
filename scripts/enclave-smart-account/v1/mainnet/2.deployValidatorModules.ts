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

async function main() {
    const [deployer] = await ethers.getSigners();

    // Debug log for environment variables
    console.log('Environment variables loaded:');
    console.log('INFURA_API_KEY:', process.env.INFURA_API_KEY ?? 'Not set');
    console.log('PRIVATE_KEY_MASTER:', process.env.PRIVATE_KEY_MASTER ?? 'Not set');

    for (let i = 0; i < mainnetSlugs.length; i++) {
        const ACTIVE_SLUG = mainnetSlugs[i];
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[ACTIVE_SLUG]));

        console.log(`Deploying validator modules with account: ${wallet.address} on network ${ACTIVE_SLUG}`);

        const networkData = deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData];
        const moduleManagerAddress = networkData.moduleManager;
        const registryAddress = networkData.registry;
        const p256PrecompileAddress = networkData.precompile.p256Verifier;

        console.log(`Using ModuleManager at: ${moduleManagerAddress}`);
        console.log(`Using Registry at: ${registryAddress}`);
        console.log(`Using P256Precompile at: ${p256PrecompileAddress}`);
        
        // Deploy P256Validator
        const P256Validator = await ethers.getContractFactory("P256Validator");
        const p256Validator = await P256Validator.connect(wallet).deploy(moduleManagerAddress, p256PrecompileAddress);
        await p256Validator.waitForDeployment();
        
        const p256ValidatorAddress = await p256Validator.getAddress();
        console.log(`P256Validator deployed to: ${p256ValidatorAddress}`);
        
        // Deploy SmartBalanceKeyValidator
        const SmartBalanceKeyValidator = await ethers.getContractFactory("SmartBalanceKeyValidator");
        const smartBalanceKeyValidator = await SmartBalanceKeyValidator.connect(wallet).deploy(registryAddress);
        await smartBalanceKeyValidator.waitForDeployment();
        
        const smartBalanceKeyValidatorAddress = await smartBalanceKeyValidator.getAddress();
        console.log(`SmartBalanceKeyValidator deployed to: ${smartBalanceKeyValidatorAddress}`);
        
        // Deploy SimpleSessionKeyValidator
        const SimpleSessionKeyValidator = await ethers.getContractFactory("SimpleSessionKeyValidator");
        const simpleSessionKeyValidator = await SimpleSessionKeyValidator.connect(wallet).deploy();
        await simpleSessionKeyValidator.waitForDeployment();
        
        const simpleSessionKeyValidatorAddress = await simpleSessionKeyValidator.getAddress();
        console.log(`SimpleSessionKeyValidator deployed to: ${simpleSessionKeyValidatorAddress}`);

        // Deploy LimitOrderSessionValidator
        console.log(`\n📦 Deploying LimitOrderSessionValidator...`);
        const LimitOrderSessionValidator = await ethers.getContractFactory("LimitOrderSessionValidator");
        const limitOrderSessionValidator = await LimitOrderSessionValidator.connect(wallet).deploy(registryAddress);
        await limitOrderSessionValidator.waitForDeployment();
        
        const limitOrderSessionValidatorAddress = await limitOrderSessionValidator.getAddress();
        console.log(`LimitOrderSessionValidator deployed to: ${limitOrderSessionValidatorAddress}`);

        // Deploy SmartAccountECDSAValidator
        console.log(`\n📦 Deploying SmartAccountECDSAValidator...`);
        const SmartAccountECDSAValidator = await ethers.getContractFactory("SmartAccountECDSAValidator");
        const smartAccountECDSAValidator = await SmartAccountECDSAValidator.connect(wallet).deploy();
        await smartAccountECDSAValidator.waitForDeployment();
        
        const smartAccountECDSAValidatorAddress = await smartAccountECDSAValidator.getAddress();
        console.log(`SmartAccountECDSAValidator deployed to: ${smartAccountECDSAValidatorAddress}`);
        
        // Update deployment data with new addresses
        (deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).accountModules = {
            p256Validator: p256ValidatorAddress,
            smartBalanceKeyValidator: smartBalanceKeyValidatorAddress,
            simpleSessionKeyValidator: simpleSessionKeyValidatorAddress,
            limitOrderSessionValidator: limitOrderSessionValidatorAddress,
            ecdsaValidator: smartAccountECDSAValidatorAddress
        };
        
        console.log(`Updated deployment data for network ${ACTIVE_SLUG}`);

        console.log(JSON.stringify((deploymentData[ACTIVE_SLUG.toString() as keyof typeof deploymentData] as any).accountModules, null, 2))
    }
    
    console.log("Deployment data updated successfully");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 