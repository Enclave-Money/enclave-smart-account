import { ethers } from "hardhat";

async function main() {
    const EnclaveVerifyingPaymaster = await ethers.getContractFactory("EnclaveVerifyingPaymaster");
    const enclaveVerifyingPayamster = await EnclaveVerifyingPaymaster.deploy("0x5FbDB2315678afecb367f032d93F642f64180aa3", await ethers.provider.getSigner());
    await enclaveVerifyingPayamster.waitForDeployment();
    console.log(`Address of enclaveVerifyingPaymaster is ${await enclaveVerifyingPayamster.getAddress()}`)
    const depoistTx = await enclaveVerifyingPayamster.deposit({value:ethers.parseEther("3")});
    await depoistTx.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});