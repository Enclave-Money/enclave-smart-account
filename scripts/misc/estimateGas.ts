// scripts/estimate-gas.ts
import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    
    // Get the current gas price
    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    console.log("Current gas price:", ethers.formatUnits(gasPrice as bigint, "gwei"), "gwei");

    let totalEstimatedGas = 0n; // Initialize total estimated gas

    // Estimate gas for deploying the Smart Contract Wallet
    const WalletFactory = await ethers.getContractFactory("P256SmartAccountFactoryV1");
    const walletFactoryDeploymentTransaction = await WalletFactory.getDeployTransaction();;
    let estimatedGas = await ethers.provider.estimateGas(walletFactoryDeploymentTransaction);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("P256SmartAccountFactoryV1: ", estimatedGas * (gasPrice as bigint));

    const P256VerifierFactory = await ethers.getContractFactory("P256Verifier");
    const txn1= await P256VerifierFactory.getDeployTransaction();;
    estimatedGas = await ethers.provider.estimateGas(txn1);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("P256Verifier: ", estimatedGas * (gasPrice as bigint));

    const Registry = await ethers.getContractFactory("EnclaveRegistry");
    const txn2= await Registry.getDeployTransaction(deployer.address);
    estimatedGas = await ethers.provider.estimateGas(txn2);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("EnclaveRegistry: ", estimatedGas * (gasPrice as bigint));

    const P256V = await ethers.getContractFactory("P256V");
    const txn3= await P256V.getDeployTransaction(deployer.address);
    estimatedGas = await ethers.provider.estimateGas(txn3);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("P256V: ", estimatedGas * (gasPrice as bigint));

    const ecdsaValidatorFac = await ethers.getContractFactory("ECDSAValidator");
    const ecdsaValidator = await ecdsaValidatorFac.getDeployTransaction();
    estimatedGas = await ethers.provider.estimateGas(ecdsaValidator);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("ECDSAValidator: ", estimatedGas * (gasPrice as bigint));

    const p256ValidatorFac = await ethers.getContractFactory("P256Validator");
    const p256Validator = await p256ValidatorFac.getDeployTransaction(deployer.address);
    estimatedGas = await ethers.provider.estimateGas(p256Validator);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("P256Validator: ", estimatedGas * (gasPrice as bigint));

    const sessionValFac = await ethers.getContractFactory("SessionKeyValidator");
    const sessionVal = await sessionValFac.getDeployTransaction(deployer.address);
    estimatedGas = await ethers.provider.estimateGas(sessionVal);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("SessionKeyValidator: ", estimatedGas * (gasPrice as bigint));

    const paymasterFac = await ethers.getContractFactory("EnclaveVerifyingPaymaster");
    const paymaster = await paymasterFac.getDeployTransaction(deployer.address, deployer.address);
    estimatedGas = await ethers.provider.estimateGas(paymaster);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("EnclaveVerifyingPaymaster: ", estimatedGas * (gasPrice as bigint));

    const feeLogicFac = await ethers.getContractFactory("EnclaveFeeLogicMainnet");
    const feeLogic = await feeLogicFac.getDeployTransaction(deployer.address, 1000);
    estimatedGas = await ethers.provider.estimateGas(feeLogic);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("EnclaveFeeLogicMainnet: ", estimatedGas * (gasPrice as bigint));

    const tokenPaymasterFac = await ethers.getContractFactory("EnclaveVerifyingTokenPaymaster");
    const tokenPaymaster = await tokenPaymasterFac.getDeployTransaction(deployer.address, deployer.address, deployer.address, deployer.address);
    estimatedGas = await ethers.provider.estimateGas(tokenPaymaster);
    totalEstimatedGas += estimatedGas*2n; // Add to total
    console.log("EnclaveVerifyingTokenPaymaster: ", estimatedGas * (gasPrice as bigint) * 2n); // USDC + USDT

    const solvPmFac = await ethers.getContractFactory("EnclaveSolverPaymasterV1Patch");
    const solvPm = await solvPmFac.getDeployTransaction(deployer.address, deployer.address);
    estimatedGas = await ethers.provider.estimateGas(solvPm);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("EnclaveSolverPaymasterV1Patch: ", estimatedGas * (gasPrice as bigint)); // USDC + USDT

    const vaultFac = await ethers.getContractFactory("EnclaveTokenVaultV1");
    const vault = await vaultFac.getDeployTransaction(deployer.address, deployer.address);
    estimatedGas = await ethers.provider.estimateGas(vault);
    totalEstimatedGas += estimatedGas; // Add to total
    console.log("EnclaveTokenVaultV1: ", estimatedGas * (gasPrice as bigint)); // USDC + USDT

    // Estimate gas for calling the createAccount function on walletFactory
    const walletFactory = await WalletFactory.deploy();
    await walletFactory.waitForDeployment();
    console.log("Wallet deployed at: ", walletFactory.target);

    console.log("Total Estimated Gas: ", totalEstimatedGas * (gasPrice as bigint)); // Display total


    const createAccountTransaction = walletFactory.interface.encodeFunctionData("createAccount", [[1,2], deployer.address, 0]); // Add parameters if needed
    estimatedGas = await ethers.provider.estimateGas({
        to: walletFactory.target,
        data: createAccountTransaction
    });
    console.log("createAccount function: ", estimatedGas * (gasPrice as bigint));
    // Log the total estimated gas
    

    // Estimate gas for deploying the Smart Contract Wallet Factory

}

// Execute the script
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});