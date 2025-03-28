import { ethers } from "hardhat";
import * as testnetContracts from "../config/testnetContracts.json";
import { MONAD_TEST_SLUG, ARB_SEPOLIA_SLUG, OP_SEPOLIA_SLUG } from "./demo/socket/constants";

async function main() {
  const currentSlug = ARB_SEPOLIA_SLUG;

  const smartAccountAddress = testnetContracts[currentSlug].smartAccountV1;
  
  // Get vault address from testnet contracts
  const vaultAddress = testnetContracts[currentSlug].vault;
  
  // Connect to the EnclaveVirtualLiquidityVault contract
  const vault = await ethers.getContractAt("EnclaveVirtualLiquidityVault", vaultAddress);
  
  console.log(`Checking deposits for user ${smartAccountAddress} on ${currentSlug}`);
  console.log(`Vault address: ${vaultAddress}`);
  
  // Use USDC as default token or take from command line
  const tokenAddress = testnetContracts[currentSlug].USDC;
  
  try {
    // Get user's deposit
    const deposit = await vault.deposits(tokenAddress, smartAccountAddress);
    console.log(`Deposit amount for USDC: ${ethers.formatUnits(deposit, 6)} USDC`);
    
    // Get total deposits for this token
    const totalDeposits = await vault.totalDeposits(tokenAddress);
    console.log(`Total deposits for USDC in vault: ${ethers.formatUnits(totalDeposits, 6)} USDC`);
    
    // Get vault liquidity for this token
    const vaultLiquidity = await vault.getVaultLiquidity(tokenAddress);
    console.log(`Available vault liquidity for USDC: ${ethers.formatUnits(vaultLiquidity, 6)} USDC`);
  } catch (err: any) {
    console.error("Error retrieving deposit information:", err.message || err);
  }
}

main().catch((error: any) => {
  console.error(error.message || error);
  process.exitCode = 1;
}); 