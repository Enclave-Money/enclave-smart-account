import { ethers } from "hardhat";
import * as testnetContracts from "../../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, ODYSSEY_SLUG, OP_SEPOLIA_SLUG, ETH_SEPOLIA_SLUG, MONAD_TEST_SLUG } from "../../../demo/socket/constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying vault with account:", deployer.address);

  // Get the network configuration
  const activeNetwork = MONAD_TEST_SLUG;
  
  // Get contract addresses from config
  const entryPoint = testnetContracts[activeNetwork].entrypoint;
  const vaultFactory = testnetContracts[activeNetwork].vaultFactory;

  // Get factory contract instance
  const factory = await ethers.getContractFactory("EnclaveVirtualLiquidityVaultFactory");
  const vaultFactoryContract = factory.attach(vaultFactory);

  // Generate a unique salt for deterministic deployment
  const salt = 0;

  // Deploy vault through factory
  const tx = await vaultFactoryContract.createVault(
    deployer.address,
    entryPoint,
    salt // deployment salt
  );

  await tx.wait();

  // Get the deployed vault address
  const vaultAddress = await vaultFactoryContract.getVaultAddress(
    deployer.address,
    entryPoint,
    salt
  );

  console.log("EnclaveVirtualLiquidityVault deployed to:", vaultAddress);
  console.log("Configuration:");
  console.log("- Manager:", deployer.address);
  console.log("- EntryPoint:", entryPoint);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
