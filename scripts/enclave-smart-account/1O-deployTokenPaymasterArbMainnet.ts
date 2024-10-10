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
    const usdc = usdcFactory.attach("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85");

    // Deploy FeeLogic contract
    // const feeLogicContractFactory = await ethers.getContractFactory("EnclaveFeeLogicMainnet");
    // const feeLogicContract = await feeLogicContractFactory.deploy(
    //     "0x13e3Ee699D1909E989722E753853AE30b17e08c5", // Chainlink ETH/USD price feed on Optimism
    //     20 // 100% markup
    // );
    // await feeLogicContract.waitForDeployment();

    
    // Attach FeeLogic contract
    const feeLogicContractFactory = await ethers.getContractFactory("EnclaveFeeLogicMainnet");
    const feeLogicContract = feeLogicContractFactory.attach("0x5C650A69e9dF3aBe9B384c07aB58Fb0fe4E8f4B4");
    console.log("EnclaveFeeLogicChainlink deployed to: ", await feeLogicContract.getAddress());
    // @ts-ignore
    console.log("Price: ", await feeLogicContract.calculateFee("0x0000000000000000000000000000000000000000", 1000000000000000));

    // // Deploy EnclaveVerifyingTokenPaymaster contract
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
    const verifyingTokenPaymaster = verifyingTokenPaymasterFactory.attach("0xB94E8384d6b68b28d87Fb216236637c2e8F27109");
    
    // @ts-ignore
    const feelogicAddress = await verifyingTokenPaymaster.feeLogic();

    console.log("1. FeeLogic address: ", feelogicAddress);
    // // update fee logic

    // @ts-ignore
    // const updateFeeLogicTx = await verifyingTokenPaymaster.updateFeeLogic(feeLogicContract.target);
    // await updateFeeLogicTx.wait();
    // console.log("Updated fee logic to: ", feeLogicContract.target);

    // // @ts-ignore
    // const feelogicAddress2 = await verifyingTokenPaymaster.feeLogic();

    // console.log("2. FeeLogic address: ", feelogicAddress2);

    // Get allowance of paymaster for usdc from wallet address
    // @ts-ignore
    const allowance = await usdc.allowance(verifyingTokenPaymaster.target, "0x7833eD45069AeE17eA8c84D7F6766CA25D1b8827");
    console.log("Allowance: ", allowance);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});