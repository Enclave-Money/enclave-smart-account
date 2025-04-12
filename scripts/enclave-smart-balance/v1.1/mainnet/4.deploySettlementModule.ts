import { ethers } from "hardhat";
import * as mainnetContracts from "../../../../config/mainnetDeploymentContracts.json";
import { ARB_MAIN_SLUG, OP_MAIN_SLUG, BASE_MAIN_SLUG } from "../../../demo/socket/constants";
import { EnclaveVirtualLiquidityVault } from "../../../../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying settlement module with account:", deployer.address);

  // Get the network configuration
  const ACTIVE_SLUG = BASE_MAIN_SLUG;

  // Get contract addresses from config
  const vaultAddress = mainnetContracts[ACTIVE_SLUG].vault;
  const socketAddress = mainnetContracts[ACTIVE_SLUG].socket.socket;
  const switchboardAddress = mainnetContracts[ACTIVE_SLUG].socket.switchboards.FAST;

  console.log("Deploying with configuration:");
  console.log("- Vault:", vaultAddress);
  console.log("- Socket:", socketAddress);
  console.log("- Switchboard:", switchboardAddress);

  // Deploy SocketDLSettlementModule
  const SettlementModule = await ethers.getContractFactory("SocketDLSettlementModule");
  const settlementModule = await SettlementModule.deploy(
    vaultAddress,
    socketAddress,
    switchboardAddress, // inbound switchboard
    switchboardAddress, // outbound switchboard
    100000, // messageGasLimit
    100 // maxBatchSize
  );

  await settlementModule.waitForDeployment();
  const settlementModuleAddress = await settlementModule.getAddress();
  console.log("\nSocketDLSettlementModule deployed to:", settlementModuleAddress);

  // Get vault contract instance
  const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
  const vault = VaultFactory.attach(vaultAddress) as EnclaveVirtualLiquidityVault;

  // Enable settlement module on vault
  console.log("\nEnabling settlement module on vault...");
  const tx = await vault.enableSettlementModule(settlementModuleAddress);
  await tx.wait();
  console.log("Settlement module enabled successfully");

  // Verify the module is enabled
  const isEnabled = await vault.isSettlementModuleEnabled(settlementModuleAddress);
  console.log("Module enabled status:", isEnabled);
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
