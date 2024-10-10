import { ethers } from "hardhat";

async function main() {

  // Print verifying signer address
  const verifyingSigner = await ethers.provider.getSigner();
  console.log(`VERIFIER_ADDRESS=${await verifyingSigner.getAddress()}`);

    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    const entryPointAddress = await entryPoint.getAddress();
    console.log(`ENTRY_POINT_ADDRESS=${ entryPointAddress }`)

    const EnclaveVerifyingPaymaster = await ethers.getContractFactory("EnclaveVerifyingPaymaster");
    const enclaveVerifyingPayamster = await EnclaveVerifyingPaymaster.deploy(entryPointAddress, await ethers.provider.getSigner());
    await enclaveVerifyingPayamster.waitForDeployment();
    const enclaveVerifyingPaymasterAddress = await enclaveVerifyingPayamster.getAddress();
    console.log(`ENCLAVE_VERIFYING_PAYMASTER_ADDRESS=${enclaveVerifyingPaymasterAddress}`)
    const depoistTx = await enclaveVerifyingPayamster.deposit({value:ethers.parseEther("0.02")});
    await depoistTx.wait();

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

    const P256Verifier = await ethers.getContractFactory("P256Verifier");
    const p256Verifier = await P256Verifier.deploy();
    await p256Verifier.waitForDeployment();
    const p256VerifierAddress = await p256Verifier.getAddress();
    console.log(`P256_VERIFIER_ADDRESS=${p256VerifierAddress}`);

    const P256SmartAccountFactory = await ethers.getContractFactory("P256SmartAccountFactory");
    const p256SmartAccountFactory = await P256SmartAccountFactory.deploy();
    await p256SmartAccountFactory.waitForDeployment();
    const p256SmartAccountFactoryAddress = await p256SmartAccountFactory.getAddress();
    console.log(`ENCLAVE_P256_SMART_ACCOUNT_FACTORY_ADDRESS=${p256SmartAccountFactoryAddress}`);

    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    const enclaveRegistry = await EnclaveRegistry.deploy();
    await enclaveRegistry.waitForDeployment();
    const enclaveRegistryAddress = await enclaveRegistry.getAddress();
    console.log(`ENCLAVE_REGISTRY_ADDRESS=${enclaveRegistryAddress}`)
    await enclaveRegistry.updateRegistryAddress("entryPoint", entryPointAddress);
    await enclaveRegistry.updateRegistryAddress("enclaveVerifyingPaymaster", enclaveVerifyingPaymasterAddress);
    await enclaveRegistry.updateRegistryAddress("paymaster", enclaveVerifyingPaymasterAddress);
    await enclaveRegistry.updateRegistryAddress("paymentToken", "0x5fd84259d66Cd46123540766Be93DFE6D43130D7");
    await enclaveRegistry.updateRegistryAddress("p256Verifier", p256VerifierAddress);
    await enclaveRegistry.updateRegistryAddress("p256SmartAccountFactory", p256SmartAccountFactoryAddress);
    console.log("Registry updated");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});