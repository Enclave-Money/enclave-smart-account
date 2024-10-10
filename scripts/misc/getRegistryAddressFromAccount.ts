import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();
    const signerAddr = await signer.getAddress();
    console.log("Signer address:", await signer.getAddress());
    // Get the account factory contract instance
    const P256SmartAccountFactory = await ethers.getContractFactory("P256SmartAccount");
    // const p256SmartAccountFactory = await P256SmartAccountFactory.deploy();
    // await p256SmartAccountFactory.waitForDeployment();
    // const p256SmartAccountFactoryAddress = await p256SmartAccountFactory.getAddress();
    // console.log(`ENCLAVE_P256_SMART_ACCOUNT_FACTORY_ADDRESS=${p256SmartAccountFactoryAddress}`);
    const p256SmartAccount = P256SmartAccountFactory.attach("0xc6d57B0843b56995bF1b131cE740407Fe2cd7936");

    // @ts-ignore
    const getDummyAddress = await p256SmartAccount.enclaveRegistry();
    console.log("Dummy Address: ", getDummyAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});