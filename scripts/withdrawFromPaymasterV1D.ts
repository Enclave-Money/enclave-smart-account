import { ethers } from "hardhat";
import { EnclaveSolverPaymasterV2D__factory } from "../typechain-types";
import * as mainnetContracts from "../config/mainnetDeploymentContracts.json"
import { ARB_MAIN_SLUG, OP_MAIN_SLUG, BASE_MAIN_SLUG } from "../config/networks";
import { IERC20__factory } from "../typechain-types";

async function main() {
  const ACTIVE_SLUG = ARB_MAIN_SLUG;
  // Contract addresses
  const PAYMASTER_V1D = "0xcC6ac1dc190500D12b34509cE24498A96CfFf4B9";
  const VAULT = mainnetContracts[ACTIVE_SLUG].vault;
  
  // USDC addresses for different chains
  const USDC_ADDRESSES = {
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",    // Optimism
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"   // Base
  };

  // Get the signer
  const [signer] = await ethers.getSigners();
  console.log("Using account:", signer.address);

  // Get the USDC address for the current chain
  const USDC_ADDRESS = USDC_ADDRESSES[ACTIVE_SLUG];
  if (!USDC_ADDRESS) {
    throw new Error(`No USDC address configured for chain`);
  }
  console.log("USDC address:", USDC_ADDRESS);

  // Get contract instances
  const usdcContract = IERC20__factory.connect(USDC_ADDRESS, signer);
  const paymaster = EnclaveSolverPaymasterV2D__factory.connect(PAYMASTER_V1D, signer);

  // Get USDC balance of paymaster
  const balance = await usdcContract.balanceOf(PAYMASTER_V1D);
  console.log("USDC balance in paymaster:", ethers.formatUnits(balance, 6));

  if (balance === 0n) {
    console.log("No USDC balance to withdraw");
    return;
  }

  // Withdraw USDC from paymaster
  console.log("Withdrawing USDC from paymaster...");
  const withdrawTx = await paymaster.withdrawToken(USDC_ADDRESS, balance);
  await withdrawTx.wait();
  console.log("Successfully withdrew USDC from paymaster");

  console.log("Transfering to vault");
  const transferTx = await usdcContract.transfer(VAULT, balance);
  await transferTx.wait();
  console.log("Successfully transferred USDC to new paymaster");

  // Verify the transfer
  const newPaymasterBalance = await usdcContract.balanceOf(PAYMASTER_V1D);
  const vaultBalance = await usdcContract.balanceOf(VAULT);
  
  console.log("New paymaster balance:", ethers.formatUnits(newPaymasterBalance, 6));
  console.log("Vault balance:", ethers.formatUnits(vaultBalance, 6));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 