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
    // await enclaveRegistry.updateRegistryAddress("paymaster", "0x930Af90BbaFC8996102B070fdeBC954331294c40");
    // await enclaveRegistry.updateRegistryAddress("paymentToken", "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d");
    await enclaveRegistry.updateRegistryAddress("entryPoint", "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789");
    console.log("Registry updated");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});