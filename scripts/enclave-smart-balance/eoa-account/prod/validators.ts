import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function main() {
  const [signer] = await ethers.getSigners();

  console.log("SIGNER: ", signer.address);
  // 3. Deploy SimpleSessionKeyValidator
  const SimpleSessionKeyValidator = await ethers.getContractFactory("SimpleSessionKeyValidator");
  const sessionKeyValidator = await SimpleSessionKeyValidator.deploy();
  await sessionKeyValidator.waitForDeployment();
  const validatorAddress = await sessionKeyValidator.getAddress();
  console.log("SimpleSessionKeyValidator deployed to:", validatorAddress);

  // Deploy SmartAccountECDSAValidator
  const ECDSAValidator = await ethers.getContractFactory("SmartAccountECDSAValidator");
  const ecdsaValidator = await ECDSAValidator.deploy();
  await ecdsaValidator.waitForDeployment();
  const ecdsaValidatorAddress = await ecdsaValidator.getAddress();
  console.log("SmartAccountECDSAValidator deployed to:", ecdsaValidatorAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
