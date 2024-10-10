import { ethers } from "hardhat";


async function main() {

    const verifyingSigner = await ethers.provider.getSigner();

    // Attach entrypoint
    const entrypointFactory = await ethers.getContractFactory("EntryPoint");
    const entryPoint = entrypointFactory.attach("0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789");

    // Attach enclave registry
    const enclaveRegistryFactory = await ethers.getContractFactory("EnclaveRegistry");
    const enclaveRegistry = enclaveRegistryFactory.attach("0x959DF35a4bDc25BA125615dfC84621D038A95FA8");

    // Attach USDC
    const usdcFactory = await ethers.getContractFactory("ERC20");
    const usdc = usdcFactory.attach("0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d");

    // Deploy FeeLogic contract
    const feeLogicContractFactory = await ethers.getContractFactory("EnclaveFeeLogicTestnet");
    const feeLogicContract = await feeLogicContractFactory.deploy();
    await feeLogicContract.waitForDeployment();

    console.log("EnclaveFeeLogicTestnet deployed to: ", await feeLogicContract.getAddress());

    // Deploy EnclaveVerifyingTokenPaymaster contract
    const verifyingTokenPaymasterFactory = await ethers.getContractFactory("EnclaveVerifyingTokenPaymaster");
    const verifyingTokenPaymaster = await verifyingTokenPaymasterFactory.deploy(
        // Entrypoint
        entryPoint.target,

        // verifyingSigner
        verifyingSigner.address,

        // paymentToken
        usdc.target,

        // feeLogic
        feeLogicContract.target
    );
    
    await verifyingTokenPaymaster.waitForDeployment();

    console.log("EnclaveVerifyingTokenPaymaster deployed to: ", await verifyingTokenPaymaster.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});