import { ethers } from "hardhat";


async function main() {

    const verifyingSigner = await ethers.provider.getSigner();

    // Attach entrypoint
    const entrypointFactory = await ethers.getContractFactory("EntryPoint");
    const entryPoint = entrypointFactory.attach("0x10D2b2c1b32b0E47299BFbF6eC078F0E1CE1DbCe");

    // Attach enclave registry
    const enclaveRegistryFactory = await ethers.getContractFactory("EnclaveRegistry");
    const enclaveRegistry = enclaveRegistryFactory.attach("0x224e0779e0Ef924f0c0954fe2C886CF58E1a293e");

    // Attach USDC
    const usdcFactory = await ethers.getContractFactory("ERC20");
    const usdc = usdcFactory.attach("0xaf88d065e77c8cC2239327C5EDb3A432268e5831");

    // Deploy FeeLogic contract
    // const feeLogicContractFactory = await ethers.getContractFactory("EnclaveFeeLogicMainnet");
    // const feeLogicContract = await feeLogicContractFactory.deploy(
    //     "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // Chainlink ETH/USD price feed on Arbitrum
    //     20 // 100% markup
    // );
    // await feeLogicContract.waitForDeployment();

    

    // // Attach FeeLogic contract
    const feeLogicContractFactory = await ethers.getContractFactory("EnclaveFeeLogicMainnet");
    const feeLogicContract = feeLogicContractFactory.attach("0x859F6ac605D36EDDeF68459D3e16cc3BE7401ee5");

    console.log("EnclaveFeeLogicChainlink deployed to: ", await feeLogicContract.getAddress());
    // @ts-ignore
    console.log("Price: ", await feeLogicContract.calculateFee("0x0000000000000000000000000000000000000000",1000000000000000));
    // Deploy EnclaveVerifyingTokenPaymaster contract
    // const verifyingTokenPaymasterFactory = await ethers.getContractFactory("EnclaveVerifyingTokenPaymaster");
    // const verifyingTokenPaymaster = await verifyingTokenPaymasterFactory.deploy(
    //     // Entrypoint
    //     entryPoint.target,

    //     // verifyingSigner
    //     verifyingSigner.address,

    //     // paymentToken
    //     usdc.target,

    //     // feeLogic
    //     feeLogicContract.target
    // );
    
    // await verifyingTokenPaymaster.waitForDeployment();

    // console.log("EnclaveVerifyingTokenPaymaster deployed to: ", await verifyingTokenPaymaster.getAddress());

    // // deposit 0.001 ETH
    // const depositTx = await verifyingTokenPaymaster.deposit({value: ethers.parseEther("0.0005")});
    // await depositTx.wait();
    // console.log("Deposited 0.0005 ETH to EnclaveVerifyingTokenPaymaster");

    // Attach EnclaveVerifyingTokenPaymaster contract
    const verifyingTokenPaymasterFactory = await ethers.getContractFactory("EnclaveVerifyingTokenPaymaster");
    const verifyingTokenPaymaster = verifyingTokenPaymasterFactory.attach("0x55E2A8708a682B2421402fF3184a5915979375Ae");

    // @ts-ignore
    const feelogicAddress = await verifyingTokenPaymaster.feeLogic();

    console.log("1. FeeLogic address: ", feelogicAddress);
    // Get allowance of paymaster for usdc from wallet address
    // update fee logic
    // @ts-ignore
    // const updateFeeLogicTx = await verifyingTokenPaymaster.updateFeeLogic(feeLogicContract.target);
    // await updateFeeLogicTx.wait();
    // console.log("Updated fee logic to: ", feeLogicContract.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});