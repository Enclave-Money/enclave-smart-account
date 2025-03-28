import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SmartAccountFactoryV1 with the account:", deployer.address);

  // Get the contract factory
  const SmartAccountFactoryV1 = await ethers.getContractFactory("SmartAccountFactoryV1");

  // Deploy the contract using CREATE2
  const factory = await SmartAccountFactoryV1.deploy();
  
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log(`SmartAccountFactoryV1 deployed to: ${factoryAddress}`);

  const impl = await factory.accountImplementation();
  console.log(`SmartAccountFactoryV1 accountImplementation: ${impl}`);

  return;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
