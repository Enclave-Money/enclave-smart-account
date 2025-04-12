import { ethers } from "hardhat";
import * as mainnetContracts from "../../../../config/mainnetDeploymentContracts.json";
import { ARB_MAIN_SLUG, OP_MAIN_SLUG, BASE_MAIN_SLUG } from "../../../demo/socket/constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying vault with account:", deployer.address);

  // Get the network configuration
  const activeNetwork = BASE_MAIN_SLUG;
  
  // Get contract addresses from config
  const entryPoint = mainnetContracts[activeNetwork].entrypoint;
  const vaultFactory = mainnetContracts[activeNetwork].vaultFactory;

  console.log("entryPoint: ", entryPoint);
  console.log("vaultFactory: ", vaultFactory);

  // Get factory contract instance
  const factory = await ethers.getContractFactory("EnclaveVirtualLiquidityVaultFactory");
  const vaultFactoryContract = factory.attach(vaultFactory);

  // Generate a unique salt for deterministic deployment
  const salt = 0;

  // Deploy vault through factory
  //@ts-ignore
  const tx = await vaultFactoryContract.createVault(
    deployer.address,
    entryPoint,
    salt // deployment salt
  );

  await tx.wait();

  // Get the deployed vault address
  //@ts-ignore
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
