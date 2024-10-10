import { ethers } from "hardhat";

async function main() {
    const EnclaveSmartAccountFactory = await ethers.getContractFactory("P256SmartAccountFactory");
    const enclaveSmartAccountFactory = await EnclaveSmartAccountFactory.deploy();
    await enclaveSmartAccountFactory.waitForDeployment();
    console.log(`Address of enclaveSmartAccountFactory is ${ await enclaveSmartAccountFactory.getAddress()}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});