import { ethers } from "hardhat";
import * as testnetContracts from "../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, ODYSSEY_SLUG, OP_SEPOLIA_SLUG } from "./constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  const activeNetwork = ARB_SEPOLIA_SLUG;

  // Get contract factory
  const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
  
  // Constructor arguments
  const owner = deployer.address;
  const entryPoint = testnetContracts[activeNetwork].entrypoint; // EntryPoint contract address
  const socketContract = testnetContracts[activeNetwork].socket.socket; // Socket contract for cross-chain
  const inboundSmartBalance = testnetContracts[activeNetwork].socket.switchboard; // Inbound smart balance contract
  const outboundSmartBalance = testnetContracts[activeNetwork].socket.switchboard; // Outbound smart balance contract

  // Deploy contract
  const vault = await VaultFactory.deploy(
    owner,
    entryPoint,
    socketContract,
    inboundSmartBalance,
    outboundSmartBalance
  );

  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  console.log("EnclaveVirtualLiquidityVault deployed to:", vaultAddress);
  console.log("Configuration:");
  console.log("- Owner:", owner);
  console.log("- EntryPoint:", entryPoint);
  console.log("- Socket Contract:", socketContract);
  console.log("- Inbound Smart Balance:", inboundSmartBalance);
  console.log("- Outbound Smart Balance:", outboundSmartBalance);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
