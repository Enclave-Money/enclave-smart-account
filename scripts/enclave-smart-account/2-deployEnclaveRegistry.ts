import { ethers } from "hardhat";

async function main() {
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");

    const enclaveRegistry = await EnclaveRegistry.deploy();
    await enclaveRegistry.waitForDeployment();
    console.log(`Address of enclaveRegistry is ${await enclaveRegistry.getAddress()}`)

    const usdcAddress = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
    const paymasterAddress = "0x166c2b871C6011ae063Cf10feb4efd95eADC6594";

    await enclaveRegistry.updateRegistryAddress("entryPoint", "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789");

    await enclaveRegistry.updateRegistryAddress("paymaster", paymasterAddress);
    await enclaveRegistry.updateRegistryAddress("paymentToken", usdcAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});