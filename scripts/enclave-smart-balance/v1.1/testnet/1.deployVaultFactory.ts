import { ethers } from "hardhat";
import * as testnetContracts from "../../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, ODYSSEY_SLUG, OP_SEPOLIA_SLUG, MONAD_TEST_SLUG } from "../../../demo/socket/constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Get the network configuration
  const activeNetwork = MONAD_TEST_SLUG;
  const entryPoint = testnetContracts[activeNetwork].entrypoint;

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
