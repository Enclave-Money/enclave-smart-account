import { ethers } from "hardhat";
import * as mainnetContracts from "../../../../config/mainnetDeploymentContracts.json";
import { ARB_MAIN_SLUG, OP_MAIN_SLUG, BASE_MAIN_SLUG } from "../../../demo/socket/constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Get the network configuration
  const activeNetwork = ARB_MAIN_SLUG;
  const entryPoint = mainnetContracts[activeNetwork].entrypoint;

  // Deploy EnclaveVirtualLiquidityVaultFactory
  const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVaultFactory");
  const vaultFactory = await VaultFactory.deploy(entryPoint);
  await vaultFactory.waitForDeployment();

  const vaultFactoryAddress = await vaultFactory.getAddress();
  console.log("EnclaveVirtualLiquidityVaultFactory deployed to:", vaultFactoryAddress);
  console.log("Configuration:");
  console.log("- EntryPoint:", entryPoint);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
