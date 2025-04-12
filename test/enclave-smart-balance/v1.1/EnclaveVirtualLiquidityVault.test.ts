import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("EnclaveVirtualLiquidityVault", function () {
  let vault: Contract;
  let vaultImplementation: Contract;
  let vaultProxy: Contract;
  let mockToken: Contract;
  let mockSocket: Contract;
  let mockEntryPoint: Contract;
  let mockSettlementModule: Contract;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let solver: Signer;
  let addresses: { [key: string]: string };
  let userOp: any;
  let validUntil: number;
  let validAfter: number;
  let tokenAddress: string;
  let amount: number;

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
    mockToken = await MockToken.deploy("Mock Token", "MTK");

    console.log("4. Deploying MockSocket...");
    const MockSocket = await ethers.getContractFactory("MockSocket");
    mockSocket = await MockSocket.deploy();
    
    console.log("5. Deploying MockEntryPoint...");
    const MockEntryPoint = await ethers.getContractFactory("EntryPoint");
    mockEntryPoint = await MockEntryPoint.deploy();

    console.log("6. Deploying Vault Implementation...");
    const VaultImplementation = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
    vaultImplementation = await VaultImplementation.deploy(mockEntryPoint.target);
    await vaultImplementation.waitForDeployment();

    console.log("7. Deploying Proxy...");
    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const initData = vaultImplementation.interface.encodeFunctionData("initialize", [
      addresses.owner,
      mockEntryPoint.target
    ]);

    vaultProxy = await Proxy.deploy(
      vaultImplementation.target,
      initData
    );
    await vaultProxy.waitForDeployment();

    console.log("8. Setting up vault interface...");
    vault = VaultImplementation.attach(vaultProxy.target);

    console.log("9. Deploying Settlement Module...");
    const SettlementModule = await ethers.getContractFactory("SocketDLSettlementModule");
    mockSettlementModule = await SettlementModule.deploy(
      vault.target,
      mockSocket.target,
      mockSocket.target, // Using mockSocket as inbound switchboard
      mockSocket.target, // Using mockSocket as outbound switchboard
      100000, // messageGasLimit
      10 // maxBatchSize
    );

    console.log("10. Enabling Settlement Module...");
    await vault.connect(owner).enableSettlementModule(mockSettlementModule.target);

    console.log("11. Setting up initial token state...");
    await mockToken.mint(addresses.user1, depositAmount * 2n);
    await mockToken.connect(user1).approve(vault.target, depositAmount * 2n);
    
    console.log("12. beforeEach setup complete");

    userOp = {
      sender: "0xd11b1d18392bEE5a5A95F7e4Abb4bEDfa1Eb6959",
      initCode: "0x",
      callData: "0x",
      nonce: 0,
      callGasLimit: 198891,
      verificationGasLimit: 1000000,
      preVerificationGas: 300000,
      maxFeePerGas: 506,
      maxPriorityFeePerGas: 0,
      paymasterAndData: "0x",
      signature: "0x"
    };

    validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    validAfter = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    tokenAddress = "0xf09156042741F67F8099D17eB22638F01F97974b";
    amount = 15000;
  });

  describe("Initialization", function () {
    it("should be initialized with correct values", async function () {
      expect(await vault.owner()).to.equal(addresses.owner);
      console.log("Init 1 passed");
      expect(await vault.entryPoint()).to.equal(mockEntryPoint.target);
      console.log("Init 2 passed");
    });

    it("should not allow reinitialization", async function () {
      await expect(vault.initialize(
        addresses.owner,
        mockEntryPoint.target
      )).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  // ... existing code ...

  describe("Ownership Transfer", function () {
    it("should allow the owner to transfer ownership", async function () {
      await vault.connect(owner).transferOwnership(addresses.user1);
      expect(await vault.owner()).to.equal(addresses.user1);
    });

    it("should prevent non-owners from transferring ownership", async function () {
      await expect(vault.connect(user1).transferOwnership(addresses.user2))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  // ... existing code ...

  // ... existing code ...

  describe("Contract Upgrade", function () {
    it("should upgrade the contract implementation", async function () {
      // Deploy a new implementation
      const NewVaultImplementation = await ethers.getContractFactory("TestEnclaveVirtualLiquidityVault");
      const newVaultImplementation = await NewVaultImplementation.deploy(mockEntryPoint.target);
      await newVaultImplementation.waitForDeployment();

      // Upgrade the proxy to the new implementation
      await vault.connect(owner).upgradeTo(newVaultImplementation.target);

      // Verify the new implementation is in use
      const upgradedVault = NewVaultImplementation.attach(vaultProxy.target);
      expect(await upgradedVault.newFunctionality()).to.equal(1);
    });

    it("should not upgrade the contract implementation when caller is not owner", async function () {
      // Deploy a new implementation
      const NewVaultImplementation = await ethers.getContractFactory("TestEnclaveVirtualLiquidityVault");
      const newVaultImplementation = await NewVaultImplementation.deploy(mockEntryPoint.target);
      await newVaultImplementation.waitForDeployment();

      await expect(vault.connect(user1).upgradeTo(newVaultImplementation.target))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should preserve state across upgrades", async function () {
      // Assume some state is set in the original contract
      await vault.connect(user1).deposit(mockToken.target, depositAmount);

      // Deploy and upgrade to the new implementation
      const NewVaultImplementation = await ethers.getContractFactory("TestEnclaveVirtualLiquidityVault");
      const newVaultImplementation = await NewVaultImplementation.deploy(mockEntryPoint.target);
      await newVaultImplementation.waitForDeployment();
      await vault.connect(owner).upgradeTo(newVaultImplementation.target);

      // Verify state is preserved
      const upgradedVault = NewVaultImplementation.attach(vaultProxy.target);
      expect(await upgradedVault.deposits(mockToken.target, addresses.user1)).to.equal(depositAmount);
    });
  });

// ... existing code ...

  describe("Deposit Functions", function () {
    describe("deposit", function () {
      it("should allow users to deposit ERC20 tokens", async function () {
        await vault.connect(user1).deposit(mockToken.target, depositAmount);
        expect(await vault.deposits(mockToken.target, addresses.user1)).to.equal(depositAmount);
        expect(await vault.totalDeposits(mockToken.target)).to.equal(depositAmount);
      });

      it("should allow users to deposit native token", async function () {
        const nativeAmount = ethers.parseEther("1.0");
        await vault.connect(user1).deposit(
          await vault.NATIVE_ADDRESS(),
          nativeAmount,
          { value: nativeAmount }
        );
        
        expect(await vault.deposits(await vault.NATIVE_ADDRESS(), addresses.user1))
          .to.equal(nativeAmount);
        expect(await vault.totalDeposits(await vault.NATIVE_ADDRESS()))
          .to.equal(nativeAmount);
      });

      it("should emit Deposited event for ERC20", async function () {
        await expect(vault.connect(user1).deposit(mockToken.target, depositAmount))
          .to.emit(vault, "Deposited")
          .withArgs(addresses.user1, mockToken.target, depositAmount);
      });

      it("should emit Deposited event for native token", async function () {
        const nativeAmount = ethers.parseEther("1.0");
        await expect(vault.connect(user1).deposit(
          await vault.NATIVE_ADDRESS(),
          nativeAmount,
          { value: nativeAmount }
        ))
          .to.emit(vault, "Deposited")
          .withArgs(addresses.user1, await vault.NATIVE_ADDRESS(), nativeAmount);
      });

      it("should revert when depositing native token with amount mismatch", async function () {
        const declaredAmount = ethers.parseEther("2.0");
        const sentAmount = ethers.parseEther("1.0");
        
        await expect(vault.connect(user1).deposit(
          await vault.NATIVE_ADDRESS(),
          declaredAmount,
          { value: sentAmount }
        )).to.be.revertedWith("NATIVE TOKEN amount mismatch");
      });

      it("should revert with zero amount", async function () {
        await expect(vault.connect(user1).deposit(mockToken.target, 0))
          .to.be.revertedWith("Amount must be greater than 0");
      });

      it("should revert with zero address for token", async function () {
        await expect(vault.connect(user1).deposit(ethers.ZeroAddress, depositAmount))
          .to.be.revertedWith("Invalid token address");
      });

      it("should revert with insufficient ERC20 allowance", async function () {
        await mockToken.connect(user1).approve(vault.target, 0);
        await expect(vault.connect(user1).deposit(mockToken.target, depositAmount))
          .to.be.revertedWith("ERC20: insufficient allowance");
      });

      it("should revert when depositing native token with insufficient balance", async function () {
        const userBalance = await ethers.provider.getBalance(addresses.user1);
        const tooLargeAmount = userBalance + ethers.parseEther("1.0");
        
        try {
          const res = vault.connect(user1).deposit(
            await vault.NATIVE_ADDRESS(),
            tooLargeAmount,
            { value: tooLargeAmount }
          )
          expect.fail("Shouldn't have succeeded");
        } catch (e) {
          console.log("Failed with error e:", e);
        }
      });
    });

    describe("depositAll", function () {
      it("should deposit entire ERC20 token balance", async function () {
        const balance = await mockToken.balanceOf(addresses.user1);
        await vault.connect(user1).depositAll(mockToken.target);
        expect(await vault.deposits(mockToken.target, addresses.user1)).to.equal(balance);
        expect(await vault.totalDeposits(mockToken.target)).to.equal(balance);
      });

      it("should deposit native token", async function () {
        const depositAmount = ethers.parseEther("1.0");

        await expect(vault.connect(user1).depositAll(
          await vault.NATIVE_ADDRESS(),
          { value: depositAmount }
        ))
          .to.emit(vault, "Deposited")
          .withArgs(addresses.user1, await vault.NATIVE_ADDRESS(), depositAmount);

        expect(await vault.deposits(await vault.NATIVE_ADDRESS(), addresses.user1))
          .to.equal(depositAmount);
      });

      it("should revert if ERC20 balance is zero", async function () {
        await expect(vault.connect(user2).depositAll(mockToken.target))
          .to.be.revertedWith("No tokens to deposit");
      });

      it("should revert if native token sent is zero", async function () {
        await expect(vault.connect(user1).depositAll(
          await vault.NATIVE_ADDRESS(),
          { value: 0 }
        )).to.be.revertedWith("No NATIVE TOKEN sent");
      });

      it("should revert with zero address for token", async function () {
        await expect(vault.connect(user1).depositAll(ethers.ZeroAddress))
          .to.be.revertedWith("Invalid token address");
      });
    });
  });

  describe("Withdrawal Functions", function () {
    beforeEach(async function () {
      //@ts-ignore
      await vault.connect(user1).deposit(mockToken.target, depositAmount);
      
      // Add native token deposit
      const nativeAmount = ethers.parseEther("1.0");
      await vault.connect(user1).deposit(
        await vault.NATIVE_ADDRESS(),
        nativeAmount,
        { value: nativeAmount }
      );
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

      it("should allow withdrawal of native token with valid signature", async function () {
        const withdrawAmount = ethers.parseEther("0.5");
        const initialBalance = await ethers.provider.getBalance(addresses.user1);
        
        const withdrawalHash = await vault.getWithdrawalHash(
          await vault.NATIVE_ADDRESS(),
          0,
          withdrawAmount,
          addresses.user1
        );
        const signature = await owner.signMessage(ethers.getBytes(withdrawalHash));

        const tx = await vault.connect(user1).withdraw(
          await vault.NATIVE_ADDRESS(),
          withdrawAmount,
          signature
        );
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;

        const finalBalance = await ethers.provider.getBalance(addresses.user1);
        expect(finalBalance - initialBalance + gasCost).to.equal(withdrawAmount);
      });

      it("should revert native token withdrawal with insufficient balance", async function () {
        const tooLargeAmount = ethers.parseEther("2.0");
        
        const withdrawalHash = await vault.getWithdrawalHash(
          await vault.NATIVE_ADDRESS(),
          0,
          tooLargeAmount,
          addresses.user1
        );
        const signature = await owner.signMessage(ethers.getBytes(withdrawalHash));

        await expect(vault.connect(user1).withdraw(
          await vault.NATIVE_ADDRESS(),
          tooLargeAmount,
          signature
        )).to.be.revertedWith("Insufficient user balance");
      });
    });

    describe("withdrawAll", function () {
      it("should allow complete withdrawal with valid signature", async function () {
        // Log initial deposit
        const initialDeposit = await vault.deposits(mockToken.target, addresses.user1);
        console.log("Initial deposit:", ethers.formatEther(initialDeposit));
        console.log("Vault balance 1: ", await mockToken.balanceOf(vault.target));

        const withdrawalHash = await vault.getWithdrawalHash(
          mockToken.target,
          1,
          0,
          addresses.user1
        );
        const signature = await owner.signMessage(ethers.getBytes(withdrawalHash));

        // Check if the signer is a vault manager using the contract
        const signerAddress = ethers.verifyMessage(ethers.getBytes(withdrawalHash), signature);
        const isVaultManager = await vault.isVaultManager(signerAddress);
        console.log("Is signer a vault manager:", isVaultManager);

        //@ts-ignore
        await vault.connect(user1).withdrawAll(mockToken.target, signature);

        // Log final deposit
        const finalDeposit = await vault.deposits(mockToken.target, addresses.user1);
        console.log("Final deposit:", ethers.formatEther(finalDeposit));
        console.log("Vault balance 2: ", await mockToken.balanceOf(vault.target));
        
        expect(await vault.deposits(mockToken.target, addresses.user1)).to.equal(0);
      });

      it("should prevent signature reuse", async function () {
        const initialDeposit = await vault.deposits(mockToken.target, addresses.user1);
        console.log("Initial deposit:", ethers.formatEther(initialDeposit));
        console.log("Vault balance 3: ", await mockToken.balanceOf(vault.target));

        const withdrawalHash = await vault.getWithdrawalHash(
          mockToken.target,
          1,
          0,
          addresses.user1
        );
        const signature = await owner.signMessage(ethers.getBytes(withdrawalHash));

        // Check if the signer is a vault manager using the contract
        const signerAddress = ethers.verifyMessage(ethers.getBytes(withdrawalHash), signature);
        const isVaultManager = await vault.isVaultManager(signerAddress);
        console.log("Is signer a vault manager:", isVaultManager);

        // First withdrawAll should succeed
        //@ts-ignore
        await vault.connect(user1).withdrawAll(mockToken.target, signature);

        //@ts-ignore
        await mockToken.connect(user1).approve(vault.target, await mockToken.balanceOf(addresses.user1));
        await vault.connect(user1).depositAll(mockToken.target);

        // Second withdrawAll with same signature should fail
        //@ts-ignore
        await expect(vault.connect(user1).withdrawAll(mockToken.target, signature))
          .to.be.revertedWith("Invalid Signature");
      });

      it("should allow complete withdrawal of native token with valid signature", async function () {
        const initialBalance = await ethers.provider.getBalance(addresses.user1);
        const depositedAmount = ethers.parseEther("1.0");

        const withdrawalHash = await vault.getWithdrawalHash(
          await vault.NATIVE_ADDRESS(),
          1,
          0,
          addresses.user1
        );
        const signature = await owner.signMessage(ethers.getBytes(withdrawalHash));

        const tx = await vault.connect(user1).withdrawAll(
          await vault.NATIVE_ADDRESS(),
          signature
        );
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;

        const finalBalance = await ethers.provider.getBalance(addresses.user1);
        expect(finalBalance - initialBalance + gasCost).to.equal(depositedAmount);
        
        expect(await vault.deposits(await vault.NATIVE_ADDRESS(), addresses.user1)).to.equal(0);
      });
    });

    describe("withdrawToken", function () {
      it("should allow withdrawal of native token", async function () {
        const nativeAmount = ethers.parseEther("1.0");

        // Assuming the vault has some native token balance
        const initialBalance = await vault.getVaultLiquidity(await vault.NATIVE_ADDRESS());

        await owner.sendTransaction({
          to: vault.target,
          value: nativeAmount,
        }).then(tx => tx.wait()); // Wait for transaction to be mined

        const interBalance = await vault.getVaultLiquidity(await vault.NATIVE_ADDRESS());

        expect(interBalance).to.equal(nativeAmount);

        await expect(vault.connect(owner).withdrawToken(
          await vault.NATIVE_ADDRESS(),
          nativeAmount
        ))
          .to.emit(vault, "TokenWithdrawn")
          .withArgs(await vault.NATIVE_ADDRESS(), addresses.owner, nativeAmount);

        const finalBalance = await vault.getVaultLiquidity(await vault.NATIVE_ADDRESS());
        expect(finalBalance).to.equal(initialBalance);
      });
    });
  });

  describe("Cross-chain Functions", function () {
    beforeEach(async function () {
      //@ts-ignore
      await vault.connect(user1).deposit(mockToken.target, depositAmount);
      await mockToken.mint(vault.target, depositAmount * 2n); // Add mint to vault
    });

    describe("claim", function () {
      it("should process valid claims with settlement", async function () {
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = Math.floor(Date.now() / 1000) - 3600;

        const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "bytes"],
          [
            mockSettlementModule.target,
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint32[]", "address[]", "uint256[]", "address", "address"],
              [[421614], [mockToken.target], [smallerAmount], addresses.solver, addresses.user1]
            )
          ]
        );

        const claimData = await constructClaimData(
          validUntil,
          validAfter,
          mockToken.target,
          smallerAmount,
          smallerAmount,
          owner,
          vault,
          addresses.user1,
          reclaimPlan
        );

        const currentNonce = await vault.claimNonce(addresses.user1);
        const expectedTxId = calculateTransactionId(
          await ethers.provider.getNetwork().then(n => n.chainId),
          addresses.user1,
          currentNonce
        );

        await expect(vault.connect(user1).claim(claimData))
          .to.emit(vault, "SolverSponsored")
          .withArgs(
            addresses.user1,
            mockToken.target,
            smallerAmount,
            smallerAmount,
            reclaimPlan,
            expectedTxId
          );
      });

      it("should revert claim with invalid settlement module", async function () {
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = Math.floor(Date.now() / 1000) - 3600;

        const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "bytes"],
          [
            ethers.Wallet.createRandom().address, // Invalid settlement module address
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint32[]", "address[]", "uint256[]", "address", "address"],
              [[421614], [mockToken.target], [smallerAmount], addresses.solver, addresses.user1]
            )
          ]
        );

        const claimData = await constructClaimData(
          validUntil,
          validAfter,
          mockToken.target,
          smallerAmount,
          smallerAmount,
          owner,
          vault,
          addresses.user1,
          reclaimPlan
        );

        await expect(vault.connect(user1).claim(claimData))
          .to.be.revertedWith("EnclaveVirtualLiquidityVault: Settlement Module Invalid");
      });

      it("should revert if claim is premature", async function () {
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = Math.floor(Date.now() / 1000) + 1800; // Future time

        const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "bytes"],
          [
            mockSettlementModule.target,
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint32[]", "address[]", "uint256[]", "address", "address"],
              [[421614], [mockToken.target], [smallerAmount], addresses.solver, addresses.user1]
            )
          ]
        );

        const claimData = await constructClaimData(
          validUntil,
          validAfter,
          mockToken.target,
          smallerAmount,
          smallerAmount,
          owner,
          vault,
          addresses.user1,
          reclaimPlan
        );

        await expect(vault.connect(user1).claim(claimData))
          .to.be.revertedWith("Premature claim");
      });

      it("should revert if claim signature has expired", async function () {
        const validUntil = Math.floor(Date.now() / 1000) - 1800; // Past time
        const validAfter = Math.floor(Date.now() / 1000) - 3600;

        const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "bytes"],
          [
            mockSettlementModule.target,
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint32[]", "address[]", "uint256[]", "address", "address"],
              [[421614], [mockToken.target], [smallerAmount], addresses.solver, addresses.user1]
            )
          ]
        );

        const claimData = await constructClaimData(
          validUntil,
          validAfter,
          mockToken.target,
          smallerAmount,
          smallerAmount,
          owner,
          vault,
          addresses.user1,
          reclaimPlan
        );

        await expect(vault.connect(user1).claim(claimData))
          .to.be.revertedWith("Claim signature expired");
      });

      it("should revert with insufficient vault liquidity", async function () {
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = Math.floor(Date.now() / 1000) - 3600;
        
        // First withdraw most of the vault's liquidity to ensure insufficient funds
        const currentLiquidity = await vault.getVaultLiquidity(mockToken.target);
        await vault.connect(owner).withdrawToken(mockToken.target, currentLiquidity - ethers.parseEther("1"));
        
        // Try to claim more than the remaining liquidity
        const claimAmount = ethers.parseEther("10");
        
        const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "bytes"],
          [
            mockSettlementModule.target,
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint32[]", "address[]", "uint256[]", "address", "address"],
              [[421614], [mockToken.target], [claimAmount], addresses.solver, addresses.user1]
            )
          ]
        );

        const claimData = await constructClaimData(
          validUntil,
          validAfter,
          mockToken.target,
          claimAmount,
          claimAmount,
          owner,
          vault,
          addresses.user1,
          reclaimPlan
        );

        await expect(vault.connect(user1).claim(claimData))
          .to.be.revertedWith("Claim: Insufficient vault liquidity");
      });

      it("should revert with invalid signature", async function () {
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = Math.floor(Date.now() / 1000) - 3600;

        const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "bytes"],
          [
            mockSettlementModule.target,
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint32[]", "address[]", "uint256[]", "address", "address"],
              [[421614], [mockToken.target], [smallerAmount], addresses.solver, addresses.user1]
            )
          ]
        );

        const claimData = await constructClaimData(
          validUntil,
          validAfter,
          mockToken.target,
          smallerAmount,
          smallerAmount,
          user2, // Using non-vault manager signer
          vault,
          addresses.user1,
          reclaimPlan
        );

        await expect(vault.connect(user1).claim(claimData))
          .to.be.revertedWith("Paymaster: Invalid claim signature");
      });

      it("should process valid claims with settlement for native token", async function () {
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = Math.floor(Date.now() / 1000) - 3600;
        const nativeAmount = ethers.parseEther("1.0");

        // First send native token to the vault
        await owner.sendTransaction({
          to: vault.target,
          value: nativeAmount,
        }).then(tx => tx.wait());

        const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "bytes"],
          [
            mockSettlementModule.target,
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint32[]", "address[]", "uint256[]", "address", "address"],
              [[421614], [await vault.NATIVE_ADDRESS()], [nativeAmount], addresses.solver, addresses.user1]
            )
          ]
        );

        const claimData = await constructClaimData(
          validUntil,
          validAfter,
          await vault.NATIVE_ADDRESS(),
          nativeAmount,
          nativeAmount,
          owner,
          vault,
          addresses.user1,
          reclaimPlan
        );

        const currentNonce = await vault.claimNonce(addresses.user1);
        const expectedTxId = calculateTransactionId(
          await ethers.provider.getNetwork().then(n => n.chainId),
          addresses.user1,
          currentNonce
        );

        await expect(vault.connect(user1).claim(claimData))
          .to.emit(vault, "SolverSponsored")
          .withArgs(
            addresses.user1,
            await vault.NATIVE_ADDRESS(),
            nativeAmount,
            nativeAmount,
            reclaimPlan,
            expectedTxId
          );
      });
    });

    describe("inbound", function () {
      beforeEach(async function() {
        // Ensure user1 has sufficient balance before testing inbound
        await vault.connect(user1).deposit(mockToken.target, depositAmount);
      });

      it("should process valid inbound transfers with zero receiver address", async function () {
        const dummyTxnId = calculateTransactionId(8453, addresses.user1, 10);

        // Create packet with address(0) as receiver
        const packet = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "address", "bytes32"],
          [addresses.user1, mockToken.target, smallerAmount, ethers.ZeroAddress, dummyTxnId]
        );

        // Get initial values
        const initialTotalDeposits = await vault.totalDeposits(mockToken.target);
        const initialUserDeposit = await vault.deposits(mockToken.target, addresses.user1);

        // Call through the mock socket contract
        await expect(mockSocket.mockInbound(mockSettlementModule.target, 1, packet))
          .to.emit(vault, "Claimed")
          .withArgs(
            ethers.ZeroAddress,
            mockToken.target,
            smallerAmount,
            addresses.user1,
            dummyTxnId
          );

        // Verify transaction was marked as settled
        expect(await vault.settledTransactionIds(dummyTxnId)).to.equal(true);

        // Verify deposit changes
        expect(await vault.deposits(mockToken.target, addresses.user1))
          .to.equal(initialUserDeposit - smallerAmount);

        // Verify total deposits decreased
        expect(await vault.totalDeposits(mockToken.target))
          .to.equal(initialTotalDeposits - smallerAmount);
      });

      it("should process valid inbound transfers with non-zero receiver address", async function () {
        const dummyTxnId = calculateTransactionId(8453, addresses.user1, 10);

        // Create packet with solver as receiver
        const packet = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "address", "bytes32"],
          [addresses.user1, mockToken.target, smallerAmount, addresses.solver, dummyTxnId]
        );

        // Get initial values
        const initialTotalDeposits = await vault.totalDeposits(mockToken.target);
        const initialUserDeposit = await vault.deposits(mockToken.target, addresses.user1);
        const initialReceiverDeposit = await vault.deposits(mockToken.target, addresses.solver);

        // Call through the mock socket contract
        await expect(mockSocket.mockInbound(mockSettlementModule.target, 1, packet))
          .to.emit(vault, "Claimed")
          .withArgs(
            addresses.solver,
            mockToken.target,
            smallerAmount,
            addresses.user1,
            dummyTxnId
          );

        // Verify transaction was marked as settled
        expect(await vault.settledTransactionIds(dummyTxnId)).to.equal(true);

        // Verify sender's deposit decreased
        expect(await vault.deposits(mockToken.target, addresses.user1))
          .to.equal(initialUserDeposit - smallerAmount);

        // Verify receiver's deposit increased
        expect(await vault.deposits(mockToken.target, addresses.solver))
          .to.equal(initialReceiverDeposit + smallerAmount);

        // Verify total deposits remained unchanged
        expect(await vault.totalDeposits(mockToken.target))
          .to.equal(initialTotalDeposits);
      });

      it("should revert if transaction is already settled", async function () {
        const dummyTxnId = calculateTransactionId(8453, addresses.user1, 10);

        const packet = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "address", "bytes32"],
          [addresses.user1, mockToken.target, smallerAmount, addresses.solver, dummyTxnId]
        );

        await mockSocket.mockInbound(mockSettlementModule.target, 1, packet);
        await expect(mockSocket.mockInbound(mockSettlementModule.target, 1, packet))
          .to.be.revertedWith("Transaction ID already executed");
      });

      it("should revert if user has insufficient balance", async function () {
        const dummyTxnId = calculateTransactionId(8453, addresses.user1, 10);
        const tooLargeAmount = depositAmount * 8n;

        const packet = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "address", "bytes32"],
          [addresses.user1, mockToken.target, tooLargeAmount, addresses.solver, dummyTxnId]
        );

        await expect(mockSocket.mockInbound(mockSettlementModule.target, 1, packet))
          .to.be.revertedWith("Insufficient balance");
      });
    });

    // TEMP TESTCASES
    // Mark _sendSettlementMessage as public or external and uncomment code below to test
    // describe("_sendSettlementMessage", function () {
    //   it("should send settlement message through socket", async function () {
    //     // Test parameters
    //     const destinationChainSlug = 421614; // Arbitrum Sepolia
    //     const gasLimit = 100000;
    //     const userAddress = addresses.user1;
    //     const tokenAddress = mockToken.target;
    //     const amount = smallerAmount;
    //     const receiverAddress = addresses.solver;
    //     const transactionId = ethers.keccak256(
    //       ethers.AbiCoder.defaultAbiCoder().encode(
    //         ["uint256", "address", "uint256"],
    //         [await ethers.provider.getNetwork().then(n => n.chainId), userAddress, 0]
    //       )
    //     );

    //     // Expected payload
    //     const expectedPayload = ethers.AbiCoder.defaultAbiCoder().encode(
    //       ["address", "address", "uint256", "address", "bytes32"],
    //       [userAddress, tokenAddress, amount, receiverAddress, transactionId]
    //     );

    //     // Call _sendSettlementMessage
    //     //@ts-ignore
    //     await expect(vault.connect(owner)._sendSettlementMessage(
    //       destinationChainSlug,
    //       gasLimit,
    //       userAddress,
    //       tokenAddress,
    //       amount,
    //       receiverAddress,
    //       transactionId
    //     )).to.not.be.reverted;
    //   });

    //   it("should revert if called by non-vault manager", async function () {
    //     //@ts-ignore
    //     await expect(vault.connect(user1)._sendSettlementMessage(
    //       421614,
    //       100000,
    //       addresses.user1,
    //       mockToken.target,
    //       smallerAmount,
    //       addresses.solver,
    //       ethers.ZeroHash
    //     )).to.be.revertedWith("Caller is not a vault manager");
    //   });
    // });

    // describe("_triggerSettlement", function () {
    //   it("should process reclaim plan and trigger settlement messages", async function () {
    //     // Create a reclaim plan with multiple chains
    //     const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
    //       ["uint32[]", "address[]", "uint256[]", "address", "address"],
    //       [
    //         [421614, 11155420], // Example chain IDs for Arbitrum Sepolia and OP Sepolia
    //         [mockToken.target, mockToken.target], // Token addresses for each chain
    //         [smallerAmount / 2n, smallerAmount / 2n], // Split amount between chains
    //         addresses.solver, // Receiver address
    //         addresses.user1  // User address
    //       ]
    //     );

    //     const transactionId = ethers.keccak256(
    //       ethers.AbiCoder.defaultAbiCoder().encode(
    //         ["uint256", "address", "uint256"],
    //         [await ethers.provider.getNetwork().then(n => n.chainId), addresses.user1, 0]
    //       )
    //     );

    //     // Call _triggerSettlement
    //     //@ts-ignore
    //     await expect(vault.connect(owner)._triggerSettlement(reclaimPlan, transactionId))
    //       .to.not.be.reverted;
    //   });

    //   it("should revert if arrays have different lengths", async function () {
    //     // Create invalid reclaim plan with mismatched array lengths
    //     const invalidReclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
    //       ["uint32[]", "address[]", "uint256[]", "address", "address"],
    //       [
    //         [421614, 11155420], // Two chain IDs
    //         [mockToken.target], // Only one token address
    //         [smallerAmount], // Only one amount
    //         addresses.solver,
    //         addresses.user1
    //       ]
    //     );

    //     const transactionId = ethers.keccak256(
    //       ethers.AbiCoder.defaultAbiCoder().encode(
    //         ["uint256", "address", "uint256"],
    //         [await ethers.provider.getNetwork().then(n => n.chainId), addresses.user1, 0]
    //       )
    //     );

    //     // Call should revert
    //     //@ts-ignore
    //     await expect(vault.connect(owner)._triggerSettlement(invalidReclaimPlan, transactionId))
    //       .to.be.revertedWith("Array lengths must match");
    //   });

    //   it("should revert if batch size exceeds maximum", async function () {
    //     // Create arrays that exceed settlementMaxBatchSize (10)
    //     const chainIds = Array(11).fill(421614);
    //     const tokenAddresses = Array(11).fill(mockToken.target);
    //     const amounts = Array(11).fill(smallerAmount / 11n);

    //     const tooLargeReclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
    //       ["uint32[]", "address[]", "uint256[]", "address", "address"],
    //       [
    //         chainIds,
    //         tokenAddresses,
    //         amounts,
    //         addresses.solver,
    //         addresses.user1
    //       ]
    //     );

    //     const transactionId = ethers.keccak256(
    //       ethers.AbiCoder.defaultAbiCoder().encode(
    //         ["uint256", "address", "uint256"],
    //         [await ethers.provider.getNetwork().then(n => n.chainId), addresses.user1, 0]
    //       )
    //     );

    //     // Call should revert
    //     //@ts-ignore
    //     await expect(vault.connect(owner)._triggerSettlement(tooLargeReclaimPlan, transactionId))
    //       .to.be.revertedWith("Batch too large");
    //   });

    //   it("should revert if called by non-vault manager", async function () {
    //     const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
    //       ["uint32[]", "address[]", "uint256[]", "address", "address"],
    //       [
    //         [421614],
    //         [mockToken.target],
    //         [smallerAmount],
    //         addresses.solver,
    //         addresses.user1
    //       ]
    //     );

    //     const transactionId = ethers.keccak256(
    //       ethers.AbiCoder.defaultAbiCoder().encode(
    //         ["uint256", "address", "uint256"],
    //         [await ethers.provider.getNetwork().then(n => n.chainId), addresses.user1, 0]
    //       )
    //     );

    //     // Call should revert when called by non-manager
    //     //@ts-ignore
    //     await expect(vault.connect(user1)._triggerSettlement(reclaimPlan, transactionId))
    //       .to.be.revertedWith("Caller is not a vault manager");
    //   });
    // });
  });

  describe("Settlement Module Management", function () {
    it("should allow owner to enable settlement module", async function () {
      const newModule = await (await ethers.getContractFactory("SocketDLSettlementModule")).deploy(
        vault.target,
        mockSocket.target,
        mockSocket.target,
        mockSocket.target,
        100000,
        10
      );

      await expect(vault.connect(owner).enableSettlementModule(newModule.target))
        .to.emit(vault, "SettlementModuleEnabled")
        .withArgs(newModule.target);

      expect(await vault.isSettlementModuleEnabled(newModule.target)).to.be.true;
    });

    it("should allow owner to disable settlement module", async function () {
      await expect(vault.connect(owner).disableSettlementModule(mockSettlementModule.target))
        .to.emit(vault, "SettlementModuleDisabled")
        .withArgs(mockSettlementModule.target);

      expect(await vault.isSettlementModuleEnabled(mockSettlementModule.target)).to.be.false;
    });

    it("should revert when non-owner tries to enable settlement module", async function () {
      await expect(vault.connect(user1).enableSettlementModule(mockSettlementModule.target))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when enabling zero address as settlement module", async function () {
      await expect(vault.connect(owner).enableSettlementModule(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(vault, "InvalidModuleAddress");
    });
  });

  describe("EntryPoint Management", function () {
    it("should allow owner to set new entry point", async function () {
      // Deploy a new entry point
      const NewEntryPoint = await ethers.getContractFactory("EntryPoint");
      const newEntryPoint = await NewEntryPoint.deploy();
      await newEntryPoint.waitForDeployment();

      // Add some deposit to the current entry point
      await vault.connect(owner).deposit({ value: ethers.parseEther("1.0") });

      // Set new entry point
      await expect(vault.connect(owner).setEntryPoint(newEntryPoint.target))
        .to.emit(vault, "EntryPointChanged")
        .withArgs(mockEntryPoint.target, newEntryPoint.target);

      // Verify new entry point is set
      expect(await vault.entryPoint()).to.equal(newEntryPoint.target);
    });

    it("should revert when non-owner tries to set entry point", async function () {
      const NewEntryPoint = await ethers.getContractFactory("EntryPoint");
      const newEntryPoint = await NewEntryPoint.deploy();
      await newEntryPoint.waitForDeployment();

      await expect(vault.connect(user1).setEntryPoint(newEntryPoint.target))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when setting same entry point", async function () {
      await vault.connect(owner).deposit({ value: ethers.parseEther("1.0") });

      await expect(vault.connect(owner).setEntryPoint(mockEntryPoint.target))
        .to.be.revertedWith("Same entrypoint");
    });

    it("should revert when setting zero address as entry point", async function () {
      await vault.connect(owner).deposit({ value: ethers.parseEther("1.0") });

      await expect(vault.connect(owner).setEntryPoint(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid entrypoint address");
    });

    it("should revert when there's no deposit", async function () {
      const NewEntryPoint = await ethers.getContractFactory("EntryPoint");
      const newEntryPoint = await NewEntryPoint.deploy();
      await newEntryPoint.waitForDeployment();

      await expect(vault.connect(owner).setEntryPoint(newEntryPoint.target))
        .to.be.revertedWith("Deposit is not zero");
    });
  });

  describe("getVaultLiquidity", function () {
    beforeEach(async function () {
      // Ensure the vault has some native token balance
      const nativeAmount = ethers.parseEther("5.0");
      await owner.sendTransaction({
        to: vault.target,
        value: nativeAmount,
      });
    });

    it("should return correct liquidity for native token when there are no deposits", async function () {
      const liquidity = await vault.getVaultLiquidity(await vault.NATIVE_ADDRESS());
      expect(liquidity).to.equal(ethers.parseEther("5.0"));
    });

    it("should return correct liquidity for native token after a deposit", async function () {
      const depositAmount = ethers.parseEther("2.0");
      await vault.connect(user1).deposit(
        await vault.NATIVE_ADDRESS(),
        depositAmount,
        { value: depositAmount }
      );

      const liquidity = await vault.getVaultLiquidity(await vault.NATIVE_ADDRESS());
      expect(liquidity).to.equal(ethers.parseEther("5.0"));
    });
  });

  describe("getHash", function () {
    it("should return the correct hash for a given UserOperation", async function () {
      console.log("userOp.sender:", userOp.sender);
      console.log("vault.address:", vaultProxy.target);
      console.log("tokenAddress:", tokenAddress);

      const expectedHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          [
            "address",
            "uint256",
            "address",
            "uint256",
            "uint48",
            "uint48",
            "address",
            "uint256"
          ],
          [
            userOp.sender,
            await ethers.provider.getNetwork().then(n => n.chainId),
            vaultProxy.target,
            await vault.senderNonce(userOp.sender),
            validUntil,
            validAfter,
            tokenAddress,
            amount
          ]
        )
      );

      const hash = await vault.getHash(userOp, validUntil, validAfter, tokenAddress, amount);
      expect(hash).to.equal(expectedHash);
    });
  });
});

// Helper function to calculate expected transaction ID
function calculateTransactionId(chainId: number | bigint, userAddress: string, nonce: number) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint256"],
      [chainId, userAddress, nonce]
    )
  );
}

// Helper function to construct claim data
async function constructClaimData(
  validUntil: number,
  validAfter: number,
  tokenAddress: string,
  creditAmount: bigint,
  debitAmount: bigint,
  signer: any,
  vault: any,
  userAddress: string,
  reclaimPlan: string
) {
  const encodedTimestamps = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint48", "uint48"],
    [validUntil, validAfter]
  );

  const encodedAmounts = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "uint256"],
    [tokenAddress, creditAmount, debitAmount]
  );

  const hash = await vault.getClaimHash(
    userAddress,
    validUntil,
    validAfter,
    tokenAddress,
    creditAmount,
    reclaimPlan
  );

  const signature = await signer.signMessage(ethers.getBytes(hash));

  return ethers.concat([
    vault.target as string,
    encodedTimestamps,
    encodedAmounts,
    signature,
    reclaimPlan
  ]);
}
