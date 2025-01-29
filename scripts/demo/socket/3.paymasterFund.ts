
import { ethers } from "hardhat";
import * as testnetContracts from "../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, ODYSSEY_SLUG, OP_SEPOLIA_SLUG } from "./constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Connecting plugs with account:", deployer.address);

  const ACTIVE_SLUG = ODYSSEY_SLUG

  // Get contract factory
  const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");

  // Connect OP Sepolia vault to Odyssey vault
  const vault = VaultFactory.attach(testnetContracts[ACTIVE_SLUG].socket.plug);
  
  //@ts-ignore

  // EntryPoint ABI - we only need the balanceOf function
  const entryPointABI = [
    "function balanceOf(address account) external view returns (uint256)"
  ];

  // EntryPoint contract address
  const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  
  // Create EntryPoint contract instance
  const entryPoint = new ethers.Contract(ENTRY_POINT, entryPointABI, deployer);

  // Check balance before deposit
  const balanceBeforeDeposit = await entryPoint.balanceOf(testnetContracts[ACTIVE_SLUG].socket.plug);
  console.log(`Current Chain Deposit: ${ethers.formatEther(balanceBeforeDeposit)} ETH`);

  // Deposit 0.001 ETH
  const depositAmount = ethers.parseEther("0.001");
  //@ts-ignore
  const tx = await vault.deposit({ value: depositAmount });
  await tx.wait();
  console.log(`Deposited ${ethers.formatEther(depositAmount)} ETH to EntryPoint`);

  // Check new balance
  const newBalance = await entryPoint.balanceOf(testnetContracts[ACTIVE_SLUG].socket.plug);
  console.log(`New Chain Deposit: ${ethers.formatEther(newBalance)} ETH`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
