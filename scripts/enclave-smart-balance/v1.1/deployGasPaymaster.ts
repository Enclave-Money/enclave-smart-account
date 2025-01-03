import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying EnclaveGasPaymaster with account:", deployer.address);

  // Deploy EnclaveGasPaymaster
  const EnclaveGasPaymaster = await ethers.getContractFactory("EnclaveGasPaymaster");
  const gasPaymaster = await EnclaveGasPaymaster.deploy("0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789");
  await gasPaymaster.waitForDeployment();

  const gasPaymasterAddress = await gasPaymaster.getAddress();
  console.log("EnclaveGasPaymaster deployed to:", gasPaymasterAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});
