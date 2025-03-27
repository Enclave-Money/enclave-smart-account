import { ethers } from "hardhat";
import * as testnetContracts from "../../config/testnetContracts.json";

async function main() {
  const wallet = new ethers.Wallet(process.env.TEST_KEY as string, ethers.provider);
  console.log("Deploying settlement module with account:", wallet.address);
  
  // Get the network configuration
  const ACTIVE_SLUG = 10143; // Monad Testnet

  // // Get contract addresses from config
  const vaultAddress = testnetContracts[ACTIVE_SLUG].vault;
  const socketAddress = testnetContracts[ACTIVE_SLUG].socket.socket;
  const switchboardAddress = testnetContracts[ACTIVE_SLUG].socket.switchboard;

  console.log("Deploying with configuration:");
  console.log("- Vault:", vaultAddress);
  console.log("- Socket:", socketAddress);
  console.log("- Switchboard:", switchboardAddress);

  // Deploy SocketDLSettlementModule
  const SettlementModule = await ethers.getContractFactory("SocketDLSettlementModule");
  const settlementModule = await SettlementModule.connect(wallet).deploy(
    vaultAddress,
    socketAddress,
    switchboardAddress, // inbound switchboard
    switchboardAddress, // outbound switchboard
    100000, // messageGasLimit
    10 // maxBatchSize
  );

  await settlementModule.waitForDeployment();
  const settlementModuleAddress = await settlementModule.getAddress();
  console.log("\nSocketDLSettlementModule deployed to:", settlementModuleAddress);

  // Get vault contract instance
  const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
  const vault = VaultFactory.attach(vaultAddress).connect(wallet) as any;

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
