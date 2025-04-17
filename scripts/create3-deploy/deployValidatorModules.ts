import { ethers } from "hardhat";

/**
 * This script deploys the EnclaveModuleManager and various validator modules.
 * It then enables all validators in the module manager.
 * Can be used with any factory deployment to enable the validator modules.
 */
async function main() {
    const [signer] = await ethers.getSigners();
    console.log(`Deploying modules using address: ${await signer.getAddress()}`);
    console.log(`Network: ${(await ethers.provider.getNetwork()).name}\n`);

    const registryAddress = "0x1a886fae3349464d569f8f1dEDfcb5F9f4eC5b9f";
    console.log(`Using registry at: ${registryAddress}\n`);

    // 1. Deploy the EnclaveModuleManager
    console.log("Deploying EnclaveModuleManager...");
    const ModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
    const moduleManager = await ModuleManager.deploy(await signer.getAddress());
    await moduleManager.waitForDeployment();
    const moduleManagerAddress = await moduleManager.getAddress();
    console.log(`EnclaveModuleManager deployed at: ${moduleManagerAddress}`);

    // 2. Deploy P256Validator
    // We'll use a mock precompile address for testing - update this in production
    const mockPrecompileAddress = await signer.getAddress(); // Using signer as mock precompile for testing
    console.log("\nDeploying P256Validator...");
    const P256Validator = await ethers.getContractFactory("P256Validator");
    const p256Validator = await P256Validator.deploy(moduleManagerAddress, mockPrecompileAddress);
    await p256Validator.waitForDeployment();
    const p256ValidatorAddress = await p256Validator.getAddress();
    console.log(`P256Validator deployed at: ${p256ValidatorAddress}`);

    // 3. Deploy SmartBalanceKeyValidator
    console.log("\nDeploying SmartBalanceKeyValidator...");
    const SmartBalanceKeyValidator = await ethers.getContractFactory("SmartBalanceKeyValidator");
    const smartBalanceKeyValidator = await SmartBalanceKeyValidator.deploy(registryAddress);
    await smartBalanceKeyValidator.waitForDeployment();
    const smartBalanceKeyValidatorAddress = await smartBalanceKeyValidator.getAddress();
    console.log(`SmartBalanceKeyValidator deployed at: ${smartBalanceKeyValidatorAddress}`);

    // 4. Deploy SimpleSessionKeyValidator
    console.log("\nDeploying SimpleSessionKeyValidator...");
    const SimpleSessionKeyValidator = await ethers.getContractFactory("SimpleSessionKeyValidator");
    const simpleSessionKeyValidator = await SimpleSessionKeyValidator.deploy();
    await simpleSessionKeyValidator.waitForDeployment();
    const simpleSessionKeyValidatorAddress = await simpleSessionKeyValidator.getAddress();
    console.log(`SimpleSessionKeyValidator deployed at: ${simpleSessionKeyValidatorAddress}`);

    // 5. Enable all validators in the ModuleManager
    console.log("\nEnabling validators in ModuleManager...");

    console.log("Enabling P256Validator...");
    let tx = await moduleManager.enableModule(p256ValidatorAddress);
    await tx.wait();
    console.log("P256Validator enabled");

    console.log("Enabling SmartBalanceKeyValidator...");
    tx = await moduleManager.enableModule(smartBalanceKeyValidatorAddress);
    await tx.wait();
    console.log("SmartBalanceKeyValidator enabled");

    console.log("Enabling SimpleSessionKeyValidator...");
    tx = await moduleManager.enableModule(simpleSessionKeyValidatorAddress);
    await tx.wait();
    console.log("SimpleSessionKeyValidator enabled");

    // 6. Verify all modules are enabled
    console.log("\nVerifying module status...");
    const p256ValidatorEnabled = await moduleManager.isModuleEnabled(p256ValidatorAddress);
    const smartBalanceKeyValidatorEnabled = await moduleManager.isModuleEnabled(smartBalanceKeyValidatorAddress);
    const simpleSessionKeyValidatorEnabled = await moduleManager.isModuleEnabled(simpleSessionKeyValidatorAddress);

    console.log(`P256Validator enabled: ${p256ValidatorEnabled}`);
    console.log(`SmartBalanceKeyValidator enabled: ${smartBalanceKeyValidatorEnabled}`);
    console.log(`SimpleSessionKeyValidator enabled: ${simpleSessionKeyValidatorEnabled}`);

    // 7. Update registry with moduleManager address if registry implementation supports it
    console.log("\nUpdating registry with ModuleManager address...");
    try {
        // Get the EnclaveRegistryV0 instance
        const registry = await ethers.getContractAt("EnclaveRegistryV0", registryAddress);

        // Update the registry with the module manager address
        const moduleManagerKey = ethers.keccak256(ethers.toUtf8Bytes("moduleManager"));
        tx = await registry.updateRegistryAddress(moduleManagerKey, moduleManagerAddress);
        await tx.wait();
        console.log("Registry updated with ModuleManager address");

        // Verify registry update
        const storedModuleManager = await registry.getRegistryAddress(moduleManagerKey);
        if (storedModuleManager.toLowerCase() === moduleManagerAddress.toLowerCase()) {
            console.log("Registry update verified successfully");
        } else {
            console.warn("Registry update could not be verified");
        }
    } catch (error: any) {
        console.error("Failed to update registry. This might be expected if registry doesn't support this operation or you don't have permission.");
        console.error(error.message);
    }

    // 8. Output deployment summary
    console.log("\n======= DEPLOYMENT SUMMARY =======");
    console.log(`Network: ${(await ethers.provider.getNetwork()).name}`);
    console.log(`Registry Address: ${registryAddress}`);
    console.log(`ModuleManager Address: ${moduleManagerAddress}`);
    console.log(`P256Validator Address: ${p256ValidatorAddress}`);
    console.log(`SmartBalanceKeyValidator Address: ${smartBalanceKeyValidatorAddress}`);
    console.log(`SimpleSessionKeyValidator Address: ${simpleSessionKeyValidatorAddress}`);
    console.log("==================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 