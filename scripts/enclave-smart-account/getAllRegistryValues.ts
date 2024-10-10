import { ethers } from "hardhat";

async function main() {

  // Print verifying signer address
  const verifyingSigner = await ethers.provider.getSigner();
  console.log(`VERIFIER_ADDRESS=${await verifyingSigner.getAddress()}`);

    // // Deploy Feelogic contract
    // const Feelogic = await ethers.getContractFactory("EnclaveFeeLogicTestnet");
    // const feelogic = await Feelogic.deploy();
    // await feelogic.waitForDeployment();
    // const feelogicAddress = await feelogic.getAddress();
    // console.log(`FEELOGIC_ADDRESS=${feelogicAddress}`);

    // // Only required for testnet
    // const MockUSDC = await ethers.getContractFactory("MockUSDC");
    // const mockUSDC = await MockUSDC.deploy("USDC", "USDC");
    // await mockUSDC.waitForDeployment();
    // const mockUSDCAddress = await mockUSDC.getAddress();
    // console.log(`MOCK_USDC_ADDRESS=${mockUSDCAddress}`);

    // const EnclaveTokenPaymaster = await ethers.getContractFactory("EnclaveVerifyingTokenPaymaster");
    // const enclaveTokenPaymaster = await EnclaveTokenPaymaster.deploy(entryPointAddress, await ethers.provider.getSigner(), mockUSDCAddress, feelogicAddress);
    // await enclaveTokenPaymaster.waitForDeployment();
    // const enclaveTokenPaymasterAddress = await enclaveTokenPaymaster.getAddress();
    // console.log(`ENCLAVE_TOKEN_PAYMASTER_ADDRESS=${enclaveTokenPaymasterAddress}`);

    const enclaveRegistry = await ethers.getContractAt("EnclaveRegistry", "0xB7283976e6084749084f4f0944146E7F168cEe38");
    
    // Get all registry values
    console.log("Registry values:");
    console.log("entryPoint", await enclaveRegistry.getRegistryAddress("entryPoint"));
    console.log("enclaveVerifyingPaymaster", await enclaveRegistry.getRegistryAddress("enclaveVerifyingPaymaster"));
    console.log("paymaster", await enclaveRegistry.getRegistryAddress("paymaster"));
    console.log("paymentToken", await enclaveRegistry.getRegistryAddress("paymentToken"));
    console.log("p256Verifier", await enclaveRegistry.getRegistryAddress("p256Verifier"));
    console.log("p256SmartAccountFactory", await enclaveRegistry.getRegistryAddress("p256SmartAccountFactory"));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});