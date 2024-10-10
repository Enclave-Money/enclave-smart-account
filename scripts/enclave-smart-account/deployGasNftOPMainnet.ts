import { ethers } from "hardhat";

async function main() {
  console.log("Deploying GasNFT contract...");

  // Get the ContractFactory for GasNFT
  const GasNFT = await ethers.getContractFactory("GasNFT");
  // Deploy the contract
  const gasNFT = await GasNFT.deploy();
  // Wait for the deployment transaction to be mined
  // @ts-ignore
  await gasNFT.waitForDeployment();
  console.log("GasNFT deployed to:", await gasNFT.getAddress());
}

// Run the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
