import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("SIGNER:", signer.address);

  // 4. Deploy SmartAccountFactory
  const SmartAccountFactory = await ethers.getContractFactory("SmartAccountFactoryV1");
  const factory = await SmartAccountFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("SmartAccountFactoryV1 deployed to:", factoryAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
