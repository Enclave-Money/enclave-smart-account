import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();
    const signerAddr = await signer.getAddress();
    console.log("Signer address:", await signer.getAddress());
    // Get the account factory contract instance
    const P256ValFac = await ethers.getContractFactory("P256Validator");
    const P256ValContract = await P256ValFac.deploy("0xA8E8f8cBD889Fc74882AeDFDcf8323fD7423DB47");
    await P256ValContract.waitForDeployment();
    const p256SmartAccountFactoryAddress = await P256ValContract.getAddress();
    console.log(`P256Validator=${p256SmartAccountFactoryAddress}`);

    // Udpate registry
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});