import { ethers } from "hardhat";
import * as testnetContracts from "../../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, OP_SEPOLIA_SLUG } from "../../../demo/socket/constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  
  const ACTIVE_SLUG = OP_SEPOLIA_SLUG
  // Get contract factories and attach
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
  
  const mockToken = MockUSDC.attach(testnetContracts[ACTIVE_SLUG].token);
  const vault = VaultFactory.attach(testnetContracts[ACTIVE_SLUG].vault);

  console.log("\nChecking balances...");

  // 1. Check vault's token balance
  const vaultBalance = await mockToken.balanceOf(vault.target);
  console.log("Vault token balance:", ethers.formatEther(vaultBalance), "USDC");

  // 2. Check user's token balance
  const userBalance = await mockToken.balanceOf(deployer.address);
  console.log("User token balance:", ethers.formatEther(userBalance), "USDC");

  // 3. Check user's deposit in vault
  const userDeposit = await vault.deposits(mockToken.target, deployer.address);
  console.log("User deposit in vault:", ethers.formatEther(userDeposit), "USDC");

  // 4. Check vault's available liquidity
  const vaultLiquidity = await vault.getVaultLiquidity(mockToken.target);
  console.log("Available vault liquidity:", ethers.formatEther(vaultLiquidity), "USDC");

  // 5. Check total deposits in vault
  const totalDeposits = await vault.totalDeposits(mockToken.target);
  console.log("Total deposits in vault:", ethers.formatEther(totalDeposits), "USDC");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
