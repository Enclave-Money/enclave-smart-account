import { ethers } from "hardhat";
import * as mainnetContracts from "../../../../config/mainnetDeploymentContracts.json";
import { EnclaveVirtualLiquidityVault, ERC20 } from "../../../../typechain-types";
import * as dotenv from 'dotenv';
import { ARB_MAIN_SLUG, BASE_MAIN_SLUG } from "../../../../config/networks";
import { JsonRpcProvider } from "ethers";
import { RPC } from "../../../../config/rpcNodes";

const env = dotenv.config();
if (env.error) {
    throw new Error('Error loading .env file');
}

// Validate required environment variables
const requiredEnvVars = ['INFURA_API_KEY', 'PRIVATE_KEY_MASTER'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// USDC addresses
const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {

  const walletArb = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[ARB_MAIN_SLUG]));
  const walletBase = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[BASE_MAIN_SLUG]));

  console.log("Using account:", walletArb.address);

  // Get contract factories
  const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
  const ERC20Factory = await ethers.getContractFactory("ERC20");

  // Attach contracts
  const vaultArb = VaultFactory.attach(mainnetContracts[ARB_MAIN_SLUG].vault).connect(walletArb) as unknown as EnclaveVirtualLiquidityVault;
  const vaultBase = VaultFactory.attach(mainnetContracts[BASE_MAIN_SLUG].vault).connect(walletBase) as unknown as EnclaveVirtualLiquidityVault;
  const usdc = ERC20Factory.attach(ARBITRUM_USDC).connect(walletArb) as ERC20;

  // Check initial USDC balance
  const initialBalance = await usdc.balanceOf(walletArb.address);
  console.log("Initial USDC balance:", ethers.formatUnits(initialBalance, 6));

  // Define deposit amount
  const depositAmount = ethers.parseUnits("1", 6);  // 100 USDC

  // Approve USDC transfer to vault
  console.log("Approving USDC transfer...");
  const approveTx = await usdc.approve(mainnetContracts[ARB_MAIN_SLUG].vault, depositAmount);
  await approveTx.wait();
  console.log("USDC transfer approved");

  // Deposit USDC into vault
  console.log("Depositing USDC into vault...");
  const depositTx = await vaultArb.deposit(ARBITRUM_USDC, depositAmount);
  await depositTx.wait();
  console.log("USDC deposited into vault on Arb");

  // Check vault liquidity after deposit
  const liquidity = await vaultBase.getVaultLiquidity(BASE_USDC);
  console.log("Current vault liquidity on Base:", ethers.formatUnits(liquidity, 6));

  // Define amounts for claim
  const creditAmount = ethers.parseUnits("1", 6);  // 100 USDC on Arbitrum
  const debitAmount = ethers.parseUnits("1", 6);   // 100 USDC on Base

  // Create timestamps
  const validUntil = Math.floor(Date.now() / 1000) + 3600;  // 1 hour from now
  const validAfter = Math.floor(Date.now() / 1000) - 3600;  // 1 hour ago

  // Create reclaim plan for Base
  const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes"],
    [
      mainnetContracts[BASE_MAIN_SLUG].settlementModules.socketDLSettlementModule,  // Settlement module address
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint32[]", "address[]", "uint256[]", "address", "address"],
        [
          [42161],  // Base chain ID
          [ARBITRUM_USDC],  // USDC address on Base
          [debitAmount],
          ethers.ZeroAddress,  // solver address
          walletArb.address   // user address
        ]
      )
    ]
  );

  console.log("Reclaim Plan: ", reclaimPlan);

  // Get hash and sign
  const hash = await vaultBase.getClaimHash(
    walletBase.address,
    validUntil,
    validAfter,
    BASE_USDC,
    creditAmount,
    reclaimPlan
  );

  console.log("Hash: ", hash);

  const signature = await walletBase.signMessage(ethers.getBytes(hash));

  // Construct claim data
  const claimData = ethers.concat([
    mainnetContracts[BASE_MAIN_SLUG].vault,
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint48", "uint48"],
      [validUntil, validAfter]
    ),
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256"],
      [BASE_USDC, creditAmount, debitAmount]
    ),
    signature,
    reclaimPlan
  ]);

  console.log("Claim calldata: ", claimData);

  console.log("Executing claim transaction...");
  const tx = await vaultBase.claim(claimData);
  const receipt = await tx.wait();
  console.log("Transaction hash:", receipt?.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
