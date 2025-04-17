import { ZeroAddress } from "ethers";
import { ethers } from "hardhat";

async function main() {

    // Deploy the factory
    console.log("Deploying P256SmartAccountCreate3Factory...");
    const P256SmartAccountCreate3Factory = await ethers.getContractFactory("P256SmartAccountCreate3Factory");
    const factory = await P256SmartAccountCreate3Factory.deploy();
    await factory.waitForDeployment();

    console.log(`Factory deployed at: ${await factory.getAddress()}`);

    // For testing purposes, also deploy a simple EnclaveRegistry mock
    const [signer] = await ethers.getSigners();
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistryV0");
    const registry = await EnclaveRegistry.deploy(await signer.getAddress());
    await registry.waitForDeployment();

    console.log(`Registry deployed at: ${await registry.getAddress()}`);

    // Mock required registry addresses
    await registry.updateRegistryAddress(
        ethers.keccak256(ethers.toUtf8Bytes("entryPoint")),
        await signer.getAddress()
    );

    await registry.updateRegistryAddress(
        ethers.keccak256(ethers.toUtf8Bytes("moduleManager")),
        await signer.getAddress()
    );

    console.log("Registry setup complete");

    // Generate a salt and get predicted address
    const salt = ethers.keccak256(ethers.toUtf8Bytes("enclave"));
    const predictedAddress = await factory.predictAccountAddress(salt);

    console.log(`Generated salt: ${salt}`);
    console.log(`Predicted account address: ${predictedAddress}`);

    // Deploy a test account
    const tx = await factory.createAccount(
        [BigInt(123), BigInt(456)], // test public key
        await registry.getAddress(),
        true, // smartBalanceEnabled
        salt
    );

    console.log("Deployment transaction sent, waiting for receipt...");
    const receipt = await tx.wait();

    if (!receipt) {
        console.error("Failed to get transaction receipt");
        return;
    }

    // Find the AccountDeployed event
    const event = receipt.logs.find(
        (e: any) => e.fragment?.name === "AccountDeployed"
    ) as any;

    if (!event || !event.args) {
        console.error("Failed to find AccountDeployed event");
        return;
    }

    const actualAddress = event.args.smartAccount;
    console.log(`Actual deployed address: ${actualAddress}`);

    // Verify the addresses match
    if (actualAddress === predictedAddress) {
        console.log("SUCCESS: Predicted and actual addresses match!");
    } else {
        console.error("ERROR: Addresses do not match!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 