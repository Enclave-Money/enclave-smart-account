import { ethers } from "hardhat";
import { Contract } from "ethers";

async function main() {
  console.log("Deploying USDC token on Monad testnet...");

  const wallet = new ethers.Wallet(process.env.TEST_KEY as string, ethers.provider);

  // Get the contract factory
  const USDCoinFactory = (await ethers.getContractFactory("USDCoin")).connect(wallet);

  const initialSupply = BigInt(1000 * 10**6);
  
  // Deploy the contract
  const usdc = await USDCoinFactory.deploy(initialSupply);
  
  // Wait for deployment to complete
  await usdc.waitForDeployment();
  
  // Get the contract address
  const usdcAddress = await usdc.getAddress();
  
  console.log(`USDC token deployed to: ${usdcAddress}`);

  const vaultAddress = "0x1c819116A4a32d9a8b74860B277554E1A6fcd7FB"; // Monad testnet vault address

  await usdc.mint(vaultAddress, initialSupply);

  console.log(`Minted ${initialSupply / BigInt(10 ** 6)} USDC to the vault address: ${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 