import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();
    const signerAddr = await signer.getAddress();
    console.log("Signer address:", await signer.getAddress());
    // Get the account factory contract instance
    const paymasterFactory = await ethers.getContractFactory("EnclaveVerifyingPaymaster");
    // const paymaster = paymasterFactory.attach("0x959DF35a4bDc25BA125615dfC84621D038A95FA8");
    const paymaster = await paymasterFactory.deploy("0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", signerAddr);
    await paymaster.waitForDeployment();
    const paymasterAddr = await paymaster.getAddress();
    console.log(`Paymaster=${paymasterAddr}`);
    const res1 = await paymaster.deposit({value: ethers.parseEther("0.1")});
    console.log("deposited in paymaster");


    const feeLogicContractFactory = await ethers.getContractFactory("EnclaveFeeLogicMainnet");
    const feeLogicContract = await feeLogicContractFactory.deploy(
        "0x976B3D034E162d8bD72D6b9C989d545b839003b0",
        20 //
    );
    await feeLogicContract.waitForDeployment();
    const feeLogicAddr = await feeLogicContract.getAddress();
    console.log("Fee Logic=",feeLogicAddr);

    const tokenPaymasterFactory = await ethers.getContractFactory("EnclaveVerifyingTokenPaymaster");
    
    const tokenPaymaster = await tokenPaymasterFactory.deploy(
        "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", 
        signerAddr,
        "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
        feeLogicAddr
    );
    await tokenPaymaster.waitForDeployment();
    console.log(`TokenPaymaster=${tokenPaymaster.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});