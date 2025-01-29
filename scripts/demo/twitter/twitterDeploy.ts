import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy Twitter Vault
  const TwitterVault = await ethers.getContractFactory("TwitterVault");
  const twitterVault = await TwitterVault.deploy();
  await twitterVault.waitForDeployment();
  const vaultAddress = await twitterVault.getAddress();
  console.log("TwitterVault deployed to:", vaultAddress);

  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log(`TWITTER_VAULT_ADDRESS=${vaultAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
