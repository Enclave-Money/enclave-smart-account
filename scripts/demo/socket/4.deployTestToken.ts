import { ethers } from "hardhat";

async function main() {
  // Get the ContractFactory for ERC20
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  
  // Deploy the contract
  const mockUSDC = await MockUSDC.deploy(
    "TEST", // name
    "TEST", // symbol
  );

  await mockUSDC.waitForDeployment();

  console.log("DummyToken deployed to:", mockUSDC.target);
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
