import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();
    const signerAddr = await signer.getAddress();
    console.log("Signer address:", await signer.getAddress());
    // Get the EnclaveRegistry contract instance
    const ownerAdd = "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00";
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    const enclaveRegistry = await EnclaveRegistry.deploy(ownerAdd);
    await enclaveRegistry.waitForDeployment();
    console.log("Deployed Registry: ", await enclaveRegistry.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});