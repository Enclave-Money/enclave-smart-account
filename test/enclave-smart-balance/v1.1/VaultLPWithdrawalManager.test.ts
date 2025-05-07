import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("VaultLPWithdrawalManager", function () {
  let vaultLPWithdrawalManager: any;
  let mockToken: any;
  let mockLiquidityVault: any;
  let owner: any;
  let lpWithdrawService: any;
  let user1: any;
  let user2: any;
  let addresses: { [key: string]: string };

  const tokenAmount = ethers.parseEther("100");

  beforeEach(async function () {
    console.log("1. Getting signers...");
    [owner, lpWithdrawService, user1, user2] = await ethers.getSigners();
    
    console.log("2. Setting up addresses...");
    addresses = {
      owner: await owner.getAddress(),
      lpWithdrawService: await lpWithdrawService.getAddress(),
      user1: await user1.getAddress(),
      user2: await user2.getAddress()
    };

    console.log("3. Deploying MockToken...");
    const TestMockUSDC = await ethers.getContractFactory("TestMockUSDC");
    mockToken = await TestMockUSDC.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    console.log("4. Deploying MockLiquidityVault...");
    const MockLiquidityVault = await ethers.getContractFactory("MockEnclaveVirtualLiquidityVault");
    mockLiquidityVault = await MockLiquidityVault.deploy();
    await mockLiquidityVault.waitForDeployment();

    console.log("5. Deploying VaultLPWithdrawalManager...");
    const VaultLPWithdrawalManager = await ethers.getContractFactory("VaultLPWithdrawalManager");
    vaultLPWithdrawalManager = await VaultLPWithdrawalManager.deploy(
      await owner.getAddress(),
      await mockLiquidityVault.getAddress(),
      await lpWithdrawService.getAddress()
    );
    await vaultLPWithdrawalManager.waitForDeployment();

    // Mint some tokens to the mock vault
    await mockToken.mint(mockLiquidityVault.target, tokenAmount * 2n);
  });

  describe("Initialization", function () {
    it("should be initialized with correct values", async function () {
      expect(await vaultLPWithdrawalManager.liquidityVault()).to.equal(await mockLiquidityVault.getAddress());
      expect(await vaultLPWithdrawalManager.lpWithdrawService()).to.equal(await lpWithdrawService.getAddress());
      
      // Check if owner is a vault manager
      expect(await vaultLPWithdrawalManager.isVaultManager(addresses.owner)).to.be.true;
    });
  });

  describe("Access Control", function () {
    it("should allow only vault manager to add a vault manager", async function () {
      await vaultLPWithdrawalManager.connect(owner).addVaultManager(addresses.user1);
      expect(await vaultLPWithdrawalManager.isVaultManager(addresses.user1)).to.be.true;
    });

    it("should prevent non-vault managers from adding a vault manager", async function () {
      await expect(vaultLPWithdrawalManager.connect(user1).addVaultManager(addresses.user1))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should allow only vault manager to remove a vault manager", async function () {
      await vaultLPWithdrawalManager.connect(owner).addVaultManager(addresses.user1);
      expect(await vaultLPWithdrawalManager.isVaultManager(addresses.user1)).to.be.true;
      
      await vaultLPWithdrawalManager.connect(owner).removeVaultManager(addresses.user1);
      expect(await vaultLPWithdrawalManager.isVaultManager(addresses.user1)).to.be.false;
    });

    it("should prevent removing self as vault manager", async function () {
      await expect(vaultLPWithdrawalManager.connect(owner).removeVaultManager(addresses.owner))
        .to.be.revertedWith("Cannot remove self as vault manager");
    });

    it("should allow vault manager to update LP withdraw service", async function () {
      await vaultLPWithdrawalManager.connect(owner).setLPWithdrawService(addresses.user1);
      expect(await vaultLPWithdrawalManager.lpWithdrawService()).to.equal(addresses.user1);
    });

    it("should prevent non-vault managers from updating LP withdraw service", async function () {
      await expect(vaultLPWithdrawalManager.connect(user1).setLPWithdrawService(addresses.user1))
        .to.be.revertedWith("Caller is not a vault manager");
    });
    
    it("should allow vault manager to update liquidity vault", async function () {
      // Deploy a new mock liquidity vault
      const NewMockVault = await ethers.getContractFactory("MockEnclaveVirtualLiquidityVault");
      const newMockVault = await NewMockVault.deploy();
      await newMockVault.waitForDeployment();
      
      await vaultLPWithdrawalManager.connect(owner).setLiquidityVault(await newMockVault.getAddress());
      expect(await vaultLPWithdrawalManager.liquidityVault()).to.equal(await newMockVault.getAddress());
    });
  });

  describe("LP Withdrawal Functionality", function () {
    it("should allow LP withdraw service to call withdrawForLP", async function () {
      // Setup mock vault to respond correctly to withdrawToken
      await mockLiquidityVault.setWithdrawSuccess(true);
      
      await mockToken.mint(vaultLPWithdrawalManager.target, tokenAmount);
      
      await expect(vaultLPWithdrawalManager.connect(lpWithdrawService).withdrawForLP(
        addresses.user1,
        mockToken.target,
        tokenAmount
      ))
        .to.emit(vaultLPWithdrawalManager, "LPWithdrawal")
        .withArgs(addresses.user1, mockToken.target, tokenAmount);
        
      // Check user balance
      expect(await mockToken.balanceOf(addresses.user1)).to.equal(tokenAmount);
    });

    it("should prevent non-LP withdraw services from calling withdrawForLP", async function () {
      await expect(vaultLPWithdrawalManager.connect(user1).withdrawForLP(
        addresses.user1,
        mockToken.target,
        tokenAmount
      ))
        .to.be.revertedWith("Caller is not the LP withdraw service");
    });

    it("should revert if the liquidityVault.withdrawToken fails", async function () {
      await mockLiquidityVault.setWithdrawSuccess(false);
      
      await expect(vaultLPWithdrawalManager.connect(lpWithdrawService).withdrawForLP(
        addresses.user1,
        mockToken.target,
        tokenAmount
      ))
        .to.be.revertedWith("Withdrawal failed");
    });

    it("should revert with invalid LP address", async function () {
      await expect(vaultLPWithdrawalManager.connect(lpWithdrawService).withdrawForLP(
        ethers.ZeroAddress,
        mockToken.target,
        tokenAmount
      ))
        .to.be.revertedWith("Invalid LP address");
    });
  });
  
  describe("Batch Withdrawal Functionality", function () {
    it("should process batch withdrawals for multiple LPs", async function () {
      // Setup mock vault to respond correctly to withdrawToken
      await mockLiquidityVault.setWithdrawSuccess(true);
      
      // Mint tokens to the manager
      await mockToken.mint(vaultLPWithdrawalManager.target, tokenAmount * 2n);
      
      const lpAddresses = [addresses.user1, addresses.user2];
      const tokenAddresses = [mockToken.target, mockToken.target];
      const amounts = [tokenAmount / 2n, tokenAmount / 2n];
      
      await vaultLPWithdrawalManager.connect(lpWithdrawService).batchWithdrawForLPs(
        lpAddresses,
        tokenAddresses,
        amounts
      );
      
      // Check user balances
      expect(await mockToken.balanceOf(addresses.user1)).to.equal(tokenAmount / 2n);
      expect(await mockToken.balanceOf(addresses.user2)).to.equal(tokenAmount / 2n);
    });
    
    it("should revert when array lengths don't match", async function () {
      const lpAddresses = [addresses.user1, addresses.user2];
      const tokenAddresses = [mockToken.target];
      const amounts = [tokenAmount / 2n, tokenAmount / 2n];
      
      await expect(vaultLPWithdrawalManager.connect(lpWithdrawService).batchWithdrawForLPs(
        lpAddresses,
        tokenAddresses,
        amounts
      ))
        .to.be.revertedWith("Array lengths must match");
    });
  });

  describe("Native Token Handling", function () {
    const nativeAmount = ethers.parseEther("1.0");

    beforeEach(async function() {
      // Fund the mock liquidity vault with native token
      await owner.sendTransaction({
        to: mockLiquidityVault.target,
        value: nativeAmount * 2n
      });
    });

    it("should handle native token withdrawals for LPs", async function() {
      // Setup mock vault to respond correctly to withdrawToken
      await mockLiquidityVault.setWithdrawSuccess(true);
      
      // Fund the VaultLPWithdrawalManager
      await owner.sendTransaction({
        to: vaultLPWithdrawalManager.target,
        value: nativeAmount
      });
      
      const initialBalance = await ethers.provider.getBalance(addresses.user1);
      
      await vaultLPWithdrawalManager.connect(lpWithdrawService).withdrawForLP(
        addresses.user1,
        await mockLiquidityVault.NATIVE_ADDRESS(),
        nativeAmount
      );
      
      const finalBalance = await ethers.provider.getBalance(addresses.user1);
      expect(finalBalance - initialBalance).to.equal(nativeAmount);
    });
    
    it("should handle native token batch withdrawals", async function() {
      // Setup mock vault to respond correctly to withdrawToken
      await mockLiquidityVault.setWithdrawSuccess(true);
      
      // Fund the manager
      await owner.sendTransaction({
        to: vaultLPWithdrawalManager.target,
        value: nativeAmount * 2n
      });
      
      const initialBalance1 = await ethers.provider.getBalance(addresses.user1);
      const initialBalance2 = await ethers.provider.getBalance(addresses.user2);
      
      const lpAddresses = [addresses.user1, addresses.user2];
      const tokenAddresses = [
        await mockLiquidityVault.NATIVE_ADDRESS(), 
        await mockLiquidityVault.NATIVE_ADDRESS()
      ];
      const amounts = [nativeAmount / 2n, nativeAmount / 2n];
      
      await vaultLPWithdrawalManager.connect(lpWithdrawService).batchWithdrawForLPs(
        lpAddresses,
        tokenAddresses,
        amounts
      );
      
      const finalBalance1 = await ethers.provider.getBalance(addresses.user1);
      const finalBalance2 = await ethers.provider.getBalance(addresses.user2);
      
      expect(finalBalance1 - initialBalance1).to.equal(nativeAmount / 2n);
      expect(finalBalance2 - initialBalance2).to.equal(nativeAmount / 2n);
    });
  });

  describe("Utility Functions", function() {
    it("should retrieve vault liquidity", async function() {
      // Setup mock vault to return a specific liquidity amount
      const expectedLiquidity = tokenAmount;
      await mockLiquidityVault.setVaultLiquidity(mockToken.target, expectedLiquidity);
      
      const liquidity = await vaultLPWithdrawalManager.getVaultLiquidity(mockToken.target);
      expect(liquidity).to.equal(expectedLiquidity);
    });
  });
}); 