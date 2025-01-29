import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Get the EnclaveRegistry address
  const registryAddress = "0xA8E8f8cBD889Fc74882AeDFDcf8323fD7423DB47";

  // Deploy TwitterSessionKeyValidator
  const TwitterSessionKeyValidator = await ethers.getContractFactory("TwitterSessionKeyValidator1");
  const twitterSessionKeyValidator = await TwitterSessionKeyValidator.deploy(registryAddress);
  await twitterSessionKeyValidator.waitForDeployment();
  const twitterValidatorAddress = await twitterSessionKeyValidator.getAddress();
  console.log("TwitterSessionKeyValidator deployed to:", twitterValidatorAddress);

  // Update registry with validator address
  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log(`TWITTER_SESSION_KEY_VALIDATOR_ADDRESS=${twitterValidatorAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
