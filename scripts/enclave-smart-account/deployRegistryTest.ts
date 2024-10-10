import { ethers } from "hardhat";

function numberToBytes32(num: number) {
    // Ensure the input is a positive integer
    if (!Number.isInteger(num) || num < 0) {
        throw new Error('Input must be a positive integer');
    }

    // Convert the number to a hexadecimal string
    let hexString = num.toString(16);

    // Pad the string to 64 characters (32 bytes)
    hexString = hexString.padStart(64, '0');

    // Add the '0x' prefix
    return '0x' + hexString;
}

async function main() {
    const [signer] = await ethers.getSigners();
    const signerAddr = await signer.getAddress();
    console.log("Signer address:", await signer.getAddress());

    // Deploy the EnclaveRegistryImplementationFactory
    const ImplementationFactory = await ethers.getContractFactory("EnclaveRegistryImplementationFactory");
    const implementationFactory = await ImplementationFactory.deploy();
    await implementationFactory.waitForDeployment();
    console.log("EnclaveRegistryImplementationFactory deployed to:", await implementationFactory.getAddress());

    // Get the implementation address for EnclaveRegistry
    const implementationAddress = await implementationFactory.getImplementationAddress(numberToBytes32(0));
    console.log("EnclaveRegistry implementation address:", implementationAddress);

    // Deploy the implementation contract (EnclaveRegistry)
    // 3. Deploy the implementation contract using the implementation factory
    const deployTx = await implementationFactory.deployImplementation(numberToBytes32(0));
    await deployTx.wait();
    console.log("EnclaveRegistry implementation deployed to:", implementationAddress);

    // 4. Deploy EnclaveRegistryFactory by passing the implementation contract address
    const EnclaveRegistryFactory = await ethers.getContractFactory("EnclaveRegistryFactory");
    const registryFactory = await EnclaveRegistryFactory.deploy(implementationAddress);
    await registryFactory.waitForDeployment();
    console.log("EnclaveRegistryFactory deployed to:", await registryFactory.getAddress());

    // Deploying EnclaveRegistry
    const predictedRegistryAddress = await registryFactory.getRegistryAddress(signerAddr, numberToBytes32(0));
    console.log("Predicted EnclaveRegistry address:", predictedRegistryAddress);

    // 6. Deploy EnclaveRegistry
    const createRegistryTx = await registryFactory.createRegistry(signer, numberToBytes32(0));
    await createRegistryTx.wait();
    console.log("EnclaveRegistry deployed to:", predictedRegistryAddress);

    // Get the EnclaveRegistry contract instance
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    const registry = EnclaveRegistry.attach(predictedRegistryAddress);

    // @ts-ignore
    console.log("REGISTRY OWNER: ", await registry.owner());

    const key = "testKey";
    const value = "0x75B853DdffECAD6192cacF0547ea25140C74FA17";
    // @ts-ignore
    const setTx = await registry.updateRegistryAddress(key, value);
    await setTx.wait();
    console.log(`Set ${key} to ${value}`);
    
    // 8. Fetch that value and ensure it is the same as the value that was set
    // @ts-ignore
    const fetchedValue = await registry.getRegistryAddress(key);
    console.log(`Fetched value for ${key}:`, fetchedValue);
    
    if (fetchedValue === value) {
        console.log("Value verification successful!");
    } else {
        console.error("Value verification failed!");
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});