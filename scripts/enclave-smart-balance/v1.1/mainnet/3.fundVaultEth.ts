import { ethers } from "hardhat";
import * as mainnetContracts from "../../../../config/mainnetDeploymentContracts.json";
import { ARB_MAIN_SLUG, OP_MAIN_SLUG, BASE_MAIN_SLUG } from "../../../demo/socket/constants";
import { EnclaveVirtualLiquidityVault, CustomBasePaymaster } from "../../../../typechain-types";

async function withdrawEth(vault: CustomBasePaymaster, withdrawAddress: string, amount: string) {
  console.log(`Withdrawing ${amount} ETH to ${withdrawAddress}`);
  
  // Convert amount to wei
  const amountWei = ethers.parseEther(amount);
  
  // Get current deposit value
  const currentDeposit = await vault.getDeposit();
  console.log("Current deposit value:", ethers.formatEther(currentDeposit), "ETH");
  
  // Check if we have enough balance
  if (currentDeposit < amountWei) {
    throw new Error(`Insufficient balance. Current deposit: ${ethers.formatEther(currentDeposit)} ETH, requested: ${amount} ETH`);
  }
  
  // Withdraw ETH
  const tx = await vault.withdrawTo(withdrawAddress, amountWei);
  console.log("Withdrawal transaction hash:", tx.hash);
  
  // Wait for the transaction to be mined
  const receipt = await tx.wait();
  console.log("Withdrawal confirmed in block:", receipt?.blockNumber);
  
  // Get and print the new deposit value
  const newDeposit = await vault.getDeposit();
  console.log("New deposit value:", ethers.formatEther(newDeposit), "ETH");
}

async function main() {
  // Get the vault contract address from environment variables
  const activeNetwork = BASE_MAIN_SLUG;

  const vaultAddress = mainnetContracts[activeNetwork].vault;
  if (!vaultAddress) {
    throw new Error("VAULT_ADDRESS environment variable not set");
  }

  // Get the signer
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  // Connect to the vault contract
  const vaultContractFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
  const vault = vaultContractFactory.attach(vaultAddress) as CustomBasePaymaster;

  // Amount to deposit (0.005 ETH)
  const amount = ethers.parseEther("0.005");
  console.log("Depositing amount:", ethers.formatEther(amount), "ETH");

  // Deposit ETH into the vault
  const tx = await vault.deposit({ value: amount });
  console.log("Transaction hash:", tx.hash);

  // Wait for the transaction to be mined
  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt?.blockNumber);

  // Get and print the deposit value
  const depositValue = await vault.getDeposit();
  console.log("Current deposit value:", ethers.formatEther(depositValue), "ETH");
  
  // Example usage of withdrawEth function
  // Uncomment and modify the following line to withdraw ETH
  // await withdrawEth(vault, "0x...", "0.001");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
