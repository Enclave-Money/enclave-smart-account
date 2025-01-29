import { ethers } from "hardhat";
import * as testnetContracts from "../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, ODYSSEY_SLUG, OP_SEPOLIA_SLUG } from "./constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const ACTIVE_SLUG = ARB_SEPOLIA_SLUG;

  // Get contract factories and attach
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
  const mockToken = MockUSDC.attach(testnetContracts[ACTIVE_SLUG].usdc);
  const vault = VaultFactory.attach(testnetContracts[ACTIVE_SLUG].socket.plug);

  console.log("Starting operations...");

  try {
    // Initial setup - mint tokens
    // const tokenAmount = ethers.parseEther("100000000");
    // await mockToken.mint(testnetContracts[ACTIVE_SLUG].socket.plug, tokenAmount);
    // console.log(`Minted ${ethers.formatEther(tokenAmount)} tokens to vault`);

    // Print initial balances
    const vaultBalance = await mockToken.balanceOf(testnetContracts[ACTIVE_SLUG].socket.plug);
    const userDeposit = await vault.deposits(testnetContracts[ACTIVE_SLUG].usdc, deployer.address);
    const vaultLiquidity = await vault.getVaultLiquidity(testnetContracts[ACTIVE_SLUG].usdc);
    console.log("\nInitial Balances:");
    console.log(`Vault Token Balance: ${vaultBalance}`);
    console.log(`User Deposit: ${userDeposit}`);
    console.log(`Vault Liquidity: ${vaultLiquidity}`);
    // return;

    // Step 1: Create UserOperation
    const userOp = {
        sender: deployer.address,
        nonce: 0,
        initCode: "0x",
        callData: "0x",
        callGasLimit: 0,
        verificationGasLimit: 0,
        preVerificationGas: 0,
        maxFeePerGas: 0,
        maxPriorityFeePerGas: 0,
        paymasterAndData: "0x",
        signature: "0x"
    };

    // Step 2: Create withdrawal plan
    const withdrawAmount = ethers.parseEther("0.1");

    
    const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint32[]", "address[]", "uint256[]", "address", "address"],
        [
            [ARB_SEPOLIA_SLUG],
            [testnetContracts[ARB_SEPOLIA_SLUG].usdc],
            [withdrawAmount],
            deployer.address,
            deployer.address
        ]
    );
    console.log("\nReclaim plan created: ", reclaimPlan);

    // Step 3: Create timestamps and encoded data
    const validUntil = Math.floor(Date.now() / 1000) + 3600;
    const validAfter = Math.floor(Date.now() / 1000);

    const encodedTimestamps = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint48", "uint48"],
        [validUntil, validAfter]
    );

    const encodedAmounts = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint256"],
        [testnetContracts[ACTIVE_SLUG].usdc, withdrawAmount, withdrawAmount]
    );

    // Step 4: Get hash and verify signature
    const hash = await vault.getHash(
        userOp,
        validUntil,
        validAfter,
        testnetContracts[ACTIVE_SLUG].usdc,
        withdrawAmount
    );
    console.log("\nGenerated hash:", hash);

    const signature = await deployer.signMessage(ethers.getBytes(hash));
    const signerAddress = ethers.verifyMessage(ethers.getBytes(hash), signature);
    console.log("Signature: ", signature);

    // Step 5: Verify vault manager status
    const isManager = await vault.isVaultManager(signerAddress);
    console.log("\nVault manager check:");
    console.log("Is signer a vault manager?", isManager);

    // Step 6: Check vault liquidity
    const currentLiquidity = await vault.getVaultLiquidity(testnetContracts[ACTIVE_SLUG].usdc);
    console.log("\nLiquidity check:");
    console.log("Required amount:", ethers.formatEther(withdrawAmount));
    console.log("Available liquidity:", ethers.formatEther(currentLiquidity));

    // Step 7: Construct paymasterAndData
    const paymasterAndData = ethers.concat([
        vault.target as string,
        encodedTimestamps,
        encodedAmounts,
        signature,
        reclaimPlan
    ]);

    // Step 8: Parse and verify paymasterAndData
    const parsed = await vault.parsePaymasterAndData(paymasterAndData);
    console.log("\nParsed paymasterAndData verification:");
    console.log("validUntil:", parsed[0]);
    console.log("validAfter:", parsed[1]);
    console.log("tokenAddress:", parsed[2]);
    console.log("creditAmount:", parsed[3]);
    console.log("debitAmount:", parsed[4]);
    console.log("signature:", parsed[5]);
    console.log("reclaimPlan:", parsed[6]);

    console.log("TEST1: Hash Check: ", !(await vault.usedClaimHashes(hash)));

    const currentBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = currentBlock?.timestamp || Math.floor(Date.now() / 1000);
    console.log("Current block timestamp:", currentTimestamp);
    
    console.log("TEST2: Timestamp Check: ", parsed[0] >= currentTimestamp && parsed[1] < currentTimestamp);
    console.log("TEST3: Liquidity Check: ", vaultLiquidity >= parsed[3]);

    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(hash), parsed[5]);
    console.log("Recovered address: ", recoveredAddress);
    console.log("TEST4: Signature valid: ", recoveredAddress === deployer.address);
    console.log("TEST5: vault manager check: ", await vault.isVaultManager(recoveredAddress));

    // Add transaction ID calculation before claim
    const claimNonceValue = await vault.claimNonce(deployer.address);
    console.log("Claim Nonce: ", claimNonceValue);
    const transactionId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "address", "uint256"],
            [await ethers.provider.getNetwork().then(n => n.chainId), deployer.address, claimNonceValue]
        )
    );
    console.log("\nTransaction ID:", transactionId);



    // Step 10: Try triggerSettlement directly
    // console.log("\nTesting triggerSettlement...");
    // await vault._triggerSettlement(reclaimPlan, transactionId);
    // console.log("Settlement triggered successfully");

    // Step 11: Update userOp with paymasterAndData
    userOp.paymasterAndData = paymasterAndData;

    // Step 12: Try claim with detailed error handling
    console.log("\nAttempting claim...");
    try {
        const claimTx = await vault.claim(userOp, hash, {
            gasLimit: 1000000
        });
        console.log("Claim transaction sent:", claimTx.hash);
        const receipt = await claimTx.wait();
        console.log("Claim successful!");
    } catch (error: any) {
        console.error("\nClaim failed with error:");
        if (error.data) {
            try {
                const iface = new ethers.Interface([
                    "function Error(string)",
                    "function Panic(uint256)"
                ]);
                const decoded = iface.decodeErrorResult("Error", error.data);
                console.error("Decoded error:", decoded);
            } catch {
                console.error("Raw error data:", error.data);
            }
        }
        throw error;
    }

  } catch (error: any) {
    console.error("Error in process:");
    console.error(error);
    if (error.reason) console.error("Error reason:", error.reason);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
