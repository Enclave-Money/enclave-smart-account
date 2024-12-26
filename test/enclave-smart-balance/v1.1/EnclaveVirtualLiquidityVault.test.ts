import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("EnclaveVirtualLiquidityVault", function () {
  let vault: Contract;
  let mockToken: Contract;
  let mockSocket: Contract;
  let mockEntryPoint: Contract;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let solver: Signer;
  let addresses: { [key: string]: string };

  const depositAmount = ethers.parseEther("100");
  const smallerAmount = ethers.parseEther("50");

  beforeEach(async function () {
    console.log("1. Getting signers...");
    [owner, user1, user2, solver] = await ethers.getSigners();
    
    console.log("2. Setting up addresses...");
    addresses = {
      owner: await owner.getAddress(),
      user1: await user1.getAddress(),
      user2: await user2.getAddress(),
      solver: await solver.getAddress()
    };

    console.log("3. Deploying MockToken...");
    const MockToken = await ethers.getContractFactory("MockUSDC");
    //@ts-ignore
    mockToken = await MockToken.deploy("Mock Token", "MTK") as Contract;

    console.log("4. Deploying MockSocket...");
    const MockSocket = await ethers.getContractFactory("MockSocket");
    //@ts-ignore
    mockSocket = await MockSocket.deploy() as Contract;
    
    console.log("5. Deploying MockEntryPoint...");
    const MockEntryPoint = await ethers.getContractFactory("EntryPoint");
    //@ts-ignore
    mockEntryPoint = await MockEntryPoint.deploy() as Contract;

    console.log("6. Deploying Vault...");
    const Vault = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
    //@ts-ignore
    vault = await Vault.deploy(
      addresses.owner,
      mockEntryPoint.target,
      mockSocket.target,
      ethers.ZeroAddress, // inboundSb
      ethers.ZeroAddress  // outboundSb
    ) as Contract;

    console.log("7. Setting up initial token state...");
    await mockToken.mint(addresses.user1, depositAmount * 2n);
    //@ts-ignore
    await mockToken.connect(user1).approve(vault.target, depositAmount * 2n);
    
    console.log("8. beforeEach setup complete");
  });

  describe("Deposit Functions", function () {
    describe("deposit", function () {
      it("should allow users to deposit tokens", async function () {
        //@ts-ignore
        await vault.connect(user1).deposit(mockToken.target, depositAmount);
        expect(await vault.deposits(mockToken.target, addresses.user1)).to.equal(depositAmount);
      });

      it("should emit Deposited event", async function () {
        //@ts-ignore
        await expect(vault.connect(user1).deposit(mockToken.target, depositAmount))
          .to.emit(vault, "Deposited")
          .withArgs(addresses.user1, mockToken.target, depositAmount);
      });

      it("should revert with zero amount", async function () {
        //@ts-ignore
        await expect(vault.connect(user1).deposit(mockToken.target, 0))
          .to.be.revertedWith("Amount must be greater than 0");
      });

      it("should revert with insufficient allowance", async function () {
        //@ts-ignore
        await mockToken.connect(user1).approve(vault.target, 0);
        //@ts-ignore
        await expect(vault.connect(user1).deposit(mockToken.target, depositAmount))
          .to.be.revertedWith("ERC20: insufficient allowance");
      });
    });

    describe("depositAll", function () {
      it("should deposit entire token balance", async function () {
        const balance = await mockToken.balanceOf(addresses.user1);
        //@ts-ignore
        await vault.connect(user1).depositAll(mockToken.target);
        expect(await vault.deposits(mockToken.target, addresses.user1)).to.equal(balance);
      });

      it("should revert if balance is zero", async function () {
        //@ts-ignore
        await expect(vault.connect(user2).depositAll(mockToken.target))
          .to.be.revertedWith("Amount must be greater than 0");
      });
    });
  });

  describe("Withdrawal Functions", function () {
    beforeEach(async function () {
      //@ts-ignore
      await vault.connect(user1).deposit(mockToken.target, depositAmount);
    });

    describe("withdraw", function () {
      it("should allow withdrawal with valid signature", async function () {
        // Log initial deposit
        const initialDeposit = await vault.deposits(mockToken.target, addresses.user1);
        console.log("Initial deposit:", ethers.formatEther(initialDeposit));

        const withdrawalHash = await vault.getWithdrawalHash(
          mockToken.target,
          0,
          smallerAmount,
          addresses.user1
        );
        const signature = await owner.signMessage(ethers.getBytes(withdrawalHash));

        // Check if the signer is a vault manager using the contract
        const signerAddress = ethers.recoverAddress(ethers.getBytes(withdrawalHash), signature);
        const isVaultManager = await vault.isVaultManager(signerAddress);
        console.log("Is signer a vault manager:", isVaultManager);

        //@ts-ignore
        await vault.connect(user1).withdraw(mockToken.target, smallerAmount, signature);
        
        // Log final deposit
        const finalDeposit = await vault.deposits(mockToken.target, addresses.user1);
        console.log("Final deposit:", ethers.formatEther(finalDeposit));
        
        expect(await vault.deposits(mockToken.target, addresses.user1)).to.equal(depositAmount - smallerAmount);
      });

      it("should revert with invalid signature", async function () {
        const withdrawalHash = await vault.getWithdrawalHash(
          mockToken.target,
          0,
          smallerAmount,
          addresses.user1
        );
        const signature = await user2.signMessage(ethers.getBytes(withdrawalHash));
        //@ts-ignore
        await expect(vault.connect(user1).withdraw(mockToken.target, smallerAmount, signature))
          .to.be.revertedWith("Invalid Signature");
      });

      it("should prevent signature reuse", async function () {
        const withdrawalHash = await vault.getWithdrawalHash(
          mockToken.target,
          0,
          smallerAmount,
          addresses.user1
        );
        const signature = await owner.signMessage(ethers.getBytes(withdrawalHash));

        // First withdrawal should succeed
        //@ts-ignore
        await vault.connect(user1).withdraw(mockToken.target, smallerAmount, signature);

        // Second withdrawal with same signature should fail
        //@ts-ignore
        await expect(vault.connect(user1).withdraw(mockToken.target, smallerAmount, signature))
          .to.be.revertedWith("Invalid Signature");
      });
    });

    describe("withdrawAll", function () {
      it("should allow complete withdrawal with valid signature", async function () {
        // Log initial deposit
        const initialDeposit = await vault.deposits(mockToken.target, addresses.user1);
        console.log("Initial deposit:", ethers.formatEther(initialDeposit));

        const withdrawalHash = await vault.getWithdrawalHash(
          mockToken.target,
          1,
          0,
          addresses.user1
        );
        const signature = await owner.signMessage(ethers.getBytes(withdrawalHash));

        // Check if the signer is a vault manager using the contract
        const signerAddress = ethers.recoverAddress(ethers.getBytes(withdrawalHash), signature);
        const isVaultManager = await vault.isVaultManager(signerAddress);
        console.log("Is signer a vault manager:", isVaultManager);

        //@ts-ignore
        await vault.connect(user1).withdrawAll(mockToken.target, signature);

        // Log final deposit
        const finalDeposit = await vault.deposits(mockToken.target, addresses.user1);
        console.log("Final deposit:", ethers.formatEther(finalDeposit));
        
        expect(await vault.deposits(mockToken.target, addresses.user1)).to.equal(0);
      });

      it("should prevent signature reuse", async function () {
        const withdrawalHash = await vault.getWithdrawalHash(
          mockToken.target,
          1,
          0,
          addresses.user1
        );
        const signature = await owner.signMessage(ethers.getBytes(withdrawalHash));

        // First withdrawAll should succeed
        //@ts-ignore
        await vault.connect(user1).withdrawAll(mockToken.target, signature);

        // Second withdrawAll with same signature should fail
        //@ts-ignore
        await expect(vault.connect(user1).withdrawAll(mockToken.target, signature))
          .to.be.revertedWith("Invalid Signature");
      });
    });
  });

  describe("Cross-chain Functions", function () {
    beforeEach(async function () {
      //@ts-ignore
      await vault.connect(user1).deposit(mockToken.target, depositAmount);
      await vault.registerSolverAddress(addresses.solver);
    });

    describe("claim", function () {
      it("should process valid claims", async function () {
        const userOp = {
          sender: addresses.user1,
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

        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = Math.floor(Date.now() / 1000) - 6000000;
        console.log("validAfter: ", validAfter);
        console.log("validUntil: ", validUntil);

        // Create encoded components for paymasterAndData
        const encodedTimestamps = ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint48", "uint48"],
          [validUntil, validAfter]
        );

        const encodedAmounts = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256", "uint256"],
          [mockToken.target, smallerAmount, smallerAmount]  // Using same amount for credit and debit
        );

        // Create a dummy reclaim plan
        const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint32[]", "address[]", "uint256[]", "address", "address"],
          [[], [], [], ethers.ZeroAddress, ethers.ZeroAddress]
        );

        const hash = await vault.getHash(userOp, validUntil, validAfter, mockToken.target, smallerAmount);
        const signature = await solver.signMessage(ethers.getBytes(hash));

        // Construct complete paymasterAndData
        const paymasterAndData = ethers.concat([
          vault.target as string,
          encodedTimestamps,
          encodedAmounts,
          signature,
          reclaimPlan
        ]);

        // Update userOp with valid paymasterAndData
        userOp.paymasterAndData = paymasterAndData;

        // Call the claim function
        await expect(vault.claim(userOp, hash, signature))
          .to.emit(vault, "SolverSponsored")
          .withArgs(userOp.sender, mockToken.target, smallerAmount, smallerAmount, vault.target, reclaimPlan);
      });

      it("should prevent signature reuse", async function () {
        const userOp = {
          sender: addresses.user1,
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

        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = Math.floor(Date.now() / 1000) - 6000000;
        
        // Create encoded components for paymasterAndData
        const encodedTimestamps = ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint48", "uint48"],
          [validUntil, validAfter]
        );

        const encodedAmounts = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256", "uint256"],
          [mockToken.target, smallerAmount, smallerAmount]  // Using same amount for credit and debit
        );

        // Create a dummy reclaim plan
        const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint32[]", "address[]", "uint256[]", "address", "address"],
          [[], [], [], ethers.ZeroAddress, ethers.ZeroAddress]
        );

        const hash = await vault.getHash(userOp, validUntil, validAfter, mockToken.target, smallerAmount);
        const signature = await solver.signMessage(ethers.getBytes(hash));

        const addressBytes = vault.target as string;
        console.log("Addr Bytes: ", addressBytes);
        // Construct complete paymasterAndData
        const paymasterAndData = ethers.concat([
          addressBytes,
          encodedTimestamps,
          encodedAmounts,
          signature,
          reclaimPlan
        ]);

        // Update userOp with valid paymasterAndData
        userOp.paymasterAndData = paymasterAndData;
        
        // First claim should succeed
        await vault.claim(userOp, hash, signature);

        // Second claim with same hash should fail
        await expect(vault.claim(userOp, hash, signature))
          .to.be.revertedWith("Hash already used");
      });
    });

    describe("inbound", function () {
      it("should process valid inbound transfers", async function () {
        const packet = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "address"],
          [addresses.user1, mockToken.target, smallerAmount, addresses.solver]
        );

        // Call through the mock socket contract which will then call the vault
        await expect(mockSocket.mockInbound(vault.target, 1, packet))
          .to.emit(vault, "Claimed")
          .withArgs(addresses.solver, mockToken.target, smallerAmount, addresses.user1);
      });

      it("should revert if caller is not socket", async function () {
        const packet = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "address"],
          [addresses.user1, mockToken.target, smallerAmount, addresses.solver]
        );

        //@ts-ignore
        await expect(vault.connect(user1).inbound(1, packet))
          .to.be.revertedWith("Caller is not Socket");
      });
    });
  });
});
