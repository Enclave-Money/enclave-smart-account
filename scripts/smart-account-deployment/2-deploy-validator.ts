import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SmartAccountECDSAValidator with the account:", deployer.address);

  // Deploy SmartAccountECDSAValidator
  const SmartAccountECDSAValidator = await ethers.getContractFactory("SmartAccountECDSAValidator");
  const validator = await SmartAccountECDSAValidator.deploy();
  await validator.waitForDeployment();
  
  const validatorAddress = await validator.getAddress();
  console.log(`SmartAccountECDSAValidator deployed to: ${validatorAddress}`);

  return;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 