import { ethers } from "hardhat";

async function main() {

  // USE PROD KEY WITH FUNDS

  const VerifyingSigner = "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00";

  const paymasterContractFactory = await ethers.getContractFactory("EnclaveSolverPaymasterV2B");
  const paymasterContract = paymasterContractFactory.attach("0x2770A44cd727982558d625f56b2b7dE3842188ac")

  console.log("Paymaster contract deployed at: ", paymasterContract.target);

  //@ts-ignore
  const tx = await paymasterContract.setDappMetadata(VerifyingSigner);
  await tx.wait();
  console.log("Fee payer set");

  //@ts-ignore
  const tx2 = await paymasterContract.deposit({ value: ethers.parseEther('0.001') });
  await tx2.wait();
  console.log("deposited");
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

