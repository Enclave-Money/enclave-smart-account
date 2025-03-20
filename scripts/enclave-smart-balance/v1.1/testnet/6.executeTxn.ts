import { ethers } from "hardhat";
import * as testnetContracts from "../../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, OP_SEPOLIA_SLUG } from "../../../demo/socket/constants";

async function main() {
  const [deployer, user] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Get contract factories and attach
  const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
  const vault = VaultFactory.attach(testnetContracts[ARB_SEPOLIA_SLUG].vault);

  // Check vault liquidity
  const liquidity = await vault.getVaultLiquidity(testnetContracts[ARB_SEPOLIA_SLUG].token);
  console.log("Current vault liquidity:", ethers.formatEther(liquidity));

  // Define amounts
  const creditAmount = ethers.parseEther("100");  // 100 USDC on Arb Sepolia
  const debitAmount = ethers.parseEther("110");   // 110 USDC on OP Sepolia

  // Create timestamps
  const validUntil = Math.floor(Date.now() / 1000) + 3600;  // 1 hour from now
  const validAfter = Math.floor(Date.now() / 1000) - 3600;  // 1 hour ago

  // Create reclaim plan for OP Sepolia
  const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes"],
    [
      testnetContracts[ARB_SEPOLIA_SLUG].module,  // Settlement module address
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint32[]", "address[]", "uint256[]", "address", "address"],
        [
          [11155420],  // OP Sepolia chain ID
          [testnetContracts[OP_SEPOLIA_SLUG].token],  // USDC address on OP Sepolia
          [debitAmount],
          user.address,  // solver address
          user.address   // user address
        ]
      )
    ]
  );

  console.log("Reclaim Plan: ", reclaimPlan);

  // Get hash and sign
  const hash = await vault.getClaimHash(
    user.address,
    validUntil,
    validAfter,
    testnetContracts[ARB_SEPOLIA_SLUG].token,
    creditAmount,
    reclaimPlan
  );

  console.log("Hash: ", hash);

  const signature = await deployer.signMessage(ethers.getBytes(hash));

  // Construct claim data
  const claimData = ethers.concat([
    testnetContracts[ARB_SEPOLIA_SLUG].vault,
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint48", "uint48"],
      [validUntil, validAfter]
    ),
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256"],
      [testnetContracts[ARB_SEPOLIA_SLUG].token, creditAmount, debitAmount]
    ),
    signature,
    reclaimPlan
  ]);

  console.log("Claim calldata: ", claimData);

  console.log("Executing claim transaction...");
  const tx = await vault.connect(user).claim(claimData);
  const receipt = await tx.wait();
  console.log("Transaction hash:", receipt.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


  // https://surge.dlapi.socket.tech/v1/messages-from-tx?srcChainSlug=911867&srcTxHash=0xdcd80a88d2206a884f8e06f710bc25aeeab530062ac9259dd799bcd5ad515448
