import { ethers } from "hardhat";

async function main() {
    const entryPointAddress = "";
    console.log(`ENTRY_POINT_ADDRESS=${ entryPointAddress }`)

    const EnclaveVerifyingPaymaster = await ethers.getContractFactory("EnclaveVerifyingPaymaster");
    const enclaveVerifyingPayamster = await EnclaveVerifyingPaymaster.deploy(entryPointAddress, await ethers.provider.getSigner());
    await enclaveVerifyingPayamster.waitForDeployment();
    const enclaveVerifyingPaymasterAddress = await enclaveVerifyingPayamster.getAddress();
    console.log(`ENCLAVE_VERIFYING_PAYMASTER_ADDRESS=${enclaveVerifyingPaymasterAddress}`)
    const depoistTx = await enclaveVerifyingPayamster.deposit({value:ethers.parseEther("0.5")});
    await depoistTx.wait();

    // Deploy Feelogic contract
    const Feelogic = await ethers.getContractFactory("EnclaveFeeLogicUniswap");
    const feelogic = await Feelogic.deploy(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // Replace with WETH9 address
      "0x1f98431c8ad98523631ae4a59f267346ea31f984", // Replace with Uniswap V3 Factory address
      1010, // Replace with markup (1.01) (1% markup)
      1000 // Replace with markupDenominator
    );
    await feelogic.waitForDeployment();
    const feelogicAddress = await feelogic.getAddress();
    console.log(`FEELOGIC_ADDRESS=${feelogicAddress}`);

    const usdcAddress = "";

    // Only required for testnet
    const EnclaveTokenPaymaster = await ethers.getContractFactory("EnclaveVerifyingTokenPaymaster");
    const enclaveTokenPaymaster = await EnclaveTokenPaymaster.deploy(entryPointAddress, await ethers.provider.getSigner(), usdcAddress, feelogicAddress);
    await enclaveTokenPaymaster.waitForDeployment();
    const enclaveTokenPaymasterAddress = await enclaveTokenPaymaster.getAddress();
    console.log(`ENCLAVE_TOKEN_PAYMASTER_ADDRESS=${enclaveTokenPaymasterAddress}`);

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
    await enclaveRegistry.updateRegistryAddress("enclaveTokenPaymaster", enclaveTokenPaymasterAddress);
    await enclaveRegistry.updateRegistryAddress("paymentToken", usdcAddress);
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