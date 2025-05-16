import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import type { MockUSDC, MockEnclaveVirtualLiquidityVault, VaultLPManager } from "../../../typechain-types";

describe("VaultLPManager", function () {
  let vaultLPManager: VaultLPManager;
  let mockLiquidityVault: MockEnclaveVirtualLiquidityVault;
  let mockUSDC: any;
  let mockUSDT: any;
  
  let owner: any;
  let vaultManager: any;
  let lpWithdrawService: any;
  let user1: any;
  let user2: any;
  
  let ownerAddress: string;
  let vaultManagerAddress: string;
  let lpWithdrawServiceAddress: string;
  let user1Address: string;
  let user2Address: string;
  
  const WITHDRAWAL_AMOUNT = ethers.parseEther("100");
  const NATIVE_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

  beforeEach(async function () {
    [owner, vaultManager, lpWithdrawService, user1, user2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    vaultManagerAddress = await vaultManager.getAddress();
    lpWithdrawServiceAddress = await lpWithdrawService.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();

    // Deploy the mock tokens - using fully qualified name
    const MockUSDCFactory = await ethers.getContractFactory("contracts/mocks/MockUSDC.sol:MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy("Mock USDC", "USDC");
    await mockUSDC.waitForDeployment();

    const MockUSDTFactory = await ethers.getContractFactory("contracts/mocks/MockUSDC.sol:MockUSDC");
    mockUSDT = await MockUSDTFactory.deploy("Mock USDT", "USDT");
    await mockUSDT.waitForDeployment();

    // Deploy the mock liquidity vault
    const MockEnclaveVirtualLiquidityVaultFactory = await ethers.getContractFactory("MockEnclaveVirtualLiquidityVault");
    mockLiquidityVault = await MockEnclaveVirtualLiquidityVaultFactory.deploy() as MockEnclaveVirtualLiquidityVault;
    await mockLiquidityVault.waitForDeployment();

    // Set vault liquidity
    await mockLiquidityVault.setVaultLiquidity(mockUSDC.target, WITHDRAWAL_AMOUNT);
    await mockLiquidityVault.setVaultLiquidity(mockUSDT.target, WITHDRAWAL_AMOUNT);
    await mockLiquidityVault.setVaultLiquidity(NATIVE_ADDRESS, WITHDRAWAL_AMOUNT);
    
    // Send ETH to the mock vault
    await owner.sendTransaction({
      to: mockLiquidityVault.target,
      value: WITHDRAWAL_AMOUNT
    });

    // Deploy the VaultLPManager
    const VaultLPManagerFactory = await ethers.getContractFactory("VaultLPManager");
    vaultLPManager = await VaultLPManagerFactory.deploy(
      vaultManagerAddress,
      mockLiquidityVault.target,
      lpWithdrawServiceAddress
    ) as VaultLPManager;
    await vaultLPManager.waitForDeployment();

    // Mint tokens and approve them
    await mockUSDC.mint(mockLiquidityVault.target, WITHDRAWAL_AMOUNT);
    await mockUSDT.mint(mockLiquidityVault.target, WITHDRAWAL_AMOUNT);
  });

  describe("Constructor", function () {
    it("should initialize with correct parameters", async function () {
      expect(await vaultLPManager.lpWithdrawService()).to.equal(lpWithdrawServiceAddress);
      expect(await vaultLPManager.liquidityVault()).to.equal(mockLiquidityVault.target);
    });

    it("should revert when initialized with zero liquidity vault address", async function () {
      const VaultLPManagerFactory = await ethers.getContractFactory("VaultLPManager");
      await expect(VaultLPManagerFactory.deploy(
        vaultManagerAddress,
        ethers.ZeroAddress,
        lpWithdrawServiceAddress
      )).to.be.revertedWith("Invalid liquidity vault address");
    });

    it("should revert when initialized with zero LP withdraw service address", async function () {
      const VaultLPManagerFactory = await ethers.getContractFactory("VaultLPManager");
      await expect(VaultLPManagerFactory.deploy(
        vaultManagerAddress,
        mockLiquidityVault.target,
        ethers.ZeroAddress
      )).to.be.revertedWith("Invalid LP withdraw service address");
    });
  });

  describe("setLPWithdrawService", function () {
    it("should update LP withdraw service address", async function () {
      await vaultLPManager.connect(vaultManager).setLPWithdrawService(user1Address);
      expect(await vaultLPManager.lpWithdrawService()).to.equal(user1Address);
    });

    it("should revert when called by non-vault manager", async function () {
      await expect(vaultLPManager.connect(user1).setLPWithdrawService(user2Address))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should revert when setting zero address", async function () {
      await expect(vaultLPManager.connect(vaultManager).setLPWithdrawService(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid LP withdraw service address");
    });
  });

  describe("setLiquidityVault", function () {
    it("should update liquidity vault address", async function () {
      // Deploy a new mock vault
      const MockEnclaveVirtualLiquidityVaultFactory = await ethers.getContractFactory("MockEnclaveVirtualLiquidityVault");
      const newMockVault = await MockEnclaveVirtualLiquidityVaultFactory.deploy() as MockEnclaveVirtualLiquidityVault;
      await newMockVault.waitForDeployment();

      await vaultLPManager.connect(vaultManager).setLiquidityVault(newMockVault.target);
      expect(await vaultLPManager.liquidityVault()).to.equal(newMockVault.target);
    });

    it("should revert when called by non-vault manager", async function () {
      const MockEnclaveVirtualLiquidityVaultFactory = await ethers.getContractFactory("MockEnclaveVirtualLiquidityVault");
      const newMockVault = await MockEnclaveVirtualLiquidityVaultFactory.deploy() as MockEnclaveVirtualLiquidityVault;
      await newMockVault.waitForDeployment();

      await expect(vaultLPManager.connect(user1).setLiquidityVault(newMockVault.target))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should revert when setting zero address", async function () {
      await expect(vaultLPManager.connect(vaultManager).setLiquidityVault(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid liquidity vault address");
    });
  });

  describe("withdrawForLP", function () {
    it("should withdraw ERC20 tokens for LP", async function () {
      // Before withdrawal
      const lpBalanceBefore = await mockUSDC.balanceOf(user1Address);
      
      // Perform withdrawal
      await vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        user1Address,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT
      );
      
      // After withdrawal
      const lpBalanceAfter = await mockUSDC.balanceOf(user1Address);
      
      expect(lpBalanceAfter - lpBalanceBefore).to.equal(WITHDRAWAL_AMOUNT);
    });

    it("should emit LPWithdrawal event for ERC20 tokens", async function () {
      await expect(vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        user1Address,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT
      )).to.emit(vaultLPManager, "LPWithdrawal")
        .withArgs(user1Address, mockUSDC.target, WITHDRAWAL_AMOUNT);
    });

    it("should withdraw native tokens for LP", async function () {
      // Before withdrawal
      const lpBalanceBefore = await ethers.provider.getBalance(user1Address);
      
      // Perform withdrawal
      await vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        user1Address,
        NATIVE_ADDRESS,
        WITHDRAWAL_AMOUNT
      );
      
      // After withdrawal
      const lpBalanceAfter = await ethers.provider.getBalance(user1Address);
      
      // We can't check exact equality because of gas fees, but can check it increased by approximately the amount
      expect(lpBalanceAfter > lpBalanceBefore).to.be.true;
      
      // The difference should be approximately equal to WITHDRAWAL_AMOUNT (allowing for rounding)
      const difference = lpBalanceAfter - lpBalanceBefore;
      expect(difference).to.be.closeTo(WITHDRAWAL_AMOUNT, WITHDRAWAL_AMOUNT / 100n); // Within 1% tolerance
    });

    it("should emit LPWithdrawal event for native tokens", async function () {
      await expect(vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        user1Address,
        NATIVE_ADDRESS,
        WITHDRAWAL_AMOUNT
      )).to.emit(vaultLPManager, "LPWithdrawal")
        .withArgs(user1Address, NATIVE_ADDRESS, WITHDRAWAL_AMOUNT);
    });

    it("should revert when called by non-LP withdraw service", async function () {
      await expect(vaultLPManager.connect(user1).withdrawForLP(
        user1Address,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT
      )).to.be.revertedWith("Caller is not the LP withdraw service");
    });

    it("should revert with invalid LP address", async function () {
      await expect(vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        ethers.ZeroAddress,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT
      )).to.be.revertedWith("Invalid LP address");
    });

    it("should revert if vault withdrawal fails", async function () {
      // Set the vault to fail withdrawals
      await mockLiquidityVault.setWithdrawSuccess(false);
      
      await expect(vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        user1Address,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT
      )).to.be.reverted;
    });

    it("should revert when amount exceeds vault liquidity", async function () {
      // Set vault liquidity to less than withdrawal amount
      const lowAmount = WITHDRAWAL_AMOUNT / 10n;
      await mockLiquidityVault.setVaultLiquidity(mockUSDC.target, lowAmount);
      
      await expect(vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        user1Address,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT
      )).to.be.revertedWith("Insufficient vault liquidity");
    });

    it("should revert when native token transfer fails", async function () {
      // Create a contract that rejects ETH transfers
      const NonPayableContractFactory = await ethers.getContractFactory("NonPayableRecipient");
      const nonPayableContract = await NonPayableContractFactory.deploy();
      await nonPayableContract.waitForDeployment();
      
      await expect(vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        await nonPayableContract.getAddress(),
        NATIVE_ADDRESS,
        WITHDRAWAL_AMOUNT
      )).to.be.revertedWith("Native token transfer failed");
    });
  });

  describe("batchWithdrawForLPs", function () {
    it("should batch withdraw tokens for multiple LPs", async function () {
      // Before withdrawal
      const user1USDCBefore = await mockUSDC.balanceOf(user1Address);
      const user2USDTBefore = await mockUSDT.balanceOf(user2Address);
      
      // Perform batch withdrawal
      await vaultLPManager.connect(lpWithdrawService).batchWithdrawForLPs(
        [user1Address, user2Address],
        [mockUSDC.target, mockUSDT.target],
        [WITHDRAWAL_AMOUNT / 2n, WITHDRAWAL_AMOUNT / 2n]
      );
      
      // After withdrawal
      const user1USDCAfter = await mockUSDC.balanceOf(user1Address);
      const user2USDTAfter = await mockUSDT.balanceOf(user2Address);
      
      expect(user1USDCAfter - user1USDCBefore).to.equal(WITHDRAWAL_AMOUNT / 2n);
      expect(user2USDTAfter - user2USDTBefore).to.equal(WITHDRAWAL_AMOUNT / 2n);
    });

    it("should emit LPWithdrawal events for each withdrawal", async function () {
      const tx = await vaultLPManager.connect(lpWithdrawService).batchWithdrawForLPs(
        [user1Address, user2Address],
        [mockUSDC.target, mockUSDT.target],
        [WITHDRAWAL_AMOUNT / 2n, WITHDRAWAL_AMOUNT / 2n]
      );
      
      const receipt = await tx.wait();
      
      // Find LPWithdrawal events
      const events = receipt?.logs.filter(
        (log: any) => log.fragment && log.fragment.name === 'LPWithdrawal'
      );
      
      // Ensure receipt is defined and contains events
      expect(receipt).to.not.be.undefined;
      expect(events).to.not.be.undefined;
      if (events) {
        expect(events.length).to.equal(2);
      }
    });

    it("should handle mixed ERC20 and native token withdrawals", async function () {
      // Before withdrawal
      const user1USDCBefore = await mockUSDC.balanceOf(user1Address);
      const user2BalanceBefore = await ethers.provider.getBalance(user2Address);
      
      // Perform batch withdrawal
      await vaultLPManager.connect(lpWithdrawService).batchWithdrawForLPs(
        [user1Address, user2Address],
        [mockUSDC.target, NATIVE_ADDRESS],
        [WITHDRAWAL_AMOUNT / 2n, WITHDRAWAL_AMOUNT / 2n]
      );
      
      // After withdrawal
      const user1USDCAfter = await mockUSDC.balanceOf(user1Address);
      const user2BalanceAfter = await ethers.provider.getBalance(user2Address);
      
      expect(user1USDCAfter - user1USDCBefore).to.equal(WITHDRAWAL_AMOUNT / 2n);
      
      // For native token, check it increased
      expect(user2BalanceAfter > user2BalanceBefore).to.be.true;
      
      // The difference should be approximately equal to WITHDRAWAL_AMOUNT/2 (allowing for rounding)
      const difference = user2BalanceAfter - user2BalanceBefore;
      expect(difference).to.be.closeTo(WITHDRAWAL_AMOUNT / 2n, (WITHDRAWAL_AMOUNT / 2n) / 100n); // Within 1% tolerance
    });

    it("should revert when called by non-LP withdraw service", async function () {
      await expect(vaultLPManager.connect(user1).batchWithdrawForLPs(
        [user1Address, user2Address],
        [mockUSDC.target, mockUSDT.target],
        [WITHDRAWAL_AMOUNT / 2n, WITHDRAWAL_AMOUNT / 2n]
      )).to.be.revertedWith("Caller is not the LP withdraw service");
    });

    it("should revert when array lengths don't match", async function () {
      // Different lengths
      await expect(vaultLPManager.connect(lpWithdrawService).batchWithdrawForLPs(
        [user1Address, user2Address],
        [mockUSDC.target],
        [WITHDRAWAL_AMOUNT / 2n, WITHDRAWAL_AMOUNT / 2n]
      )).to.be.revertedWith("Array lengths must match");
      
      await expect(vaultLPManager.connect(lpWithdrawService).batchWithdrawForLPs(
        [user1Address, user2Address],
        [mockUSDC.target, mockUSDT.target],
        [WITHDRAWAL_AMOUNT / 2n]
      )).to.be.revertedWith("Array lengths must match");
    });

    it("should revert with invalid LP address in batch", async function () {
      await expect(vaultLPManager.connect(lpWithdrawService).batchWithdrawForLPs(
        [ethers.ZeroAddress, user2Address],
        [mockUSDC.target, mockUSDT.target],
        [WITHDRAWAL_AMOUNT / 2n, WITHDRAWAL_AMOUNT / 2n]
      )).to.be.revertedWith("Invalid LP address");
    });

    it("should revert if any vault withdrawal fails", async function () {
      // Set the vault to fail withdrawals
      await mockLiquidityVault.setWithdrawSuccess(false);
      
      await expect(vaultLPManager.connect(lpWithdrawService).batchWithdrawForLPs(
        [user1Address, user2Address],
        [mockUSDC.target, mockUSDT.target],
        [WITHDRAWAL_AMOUNT / 2n, WITHDRAWAL_AMOUNT / 2n]
      )).to.be.reverted;
    });
    
    it("should revert when any amount exceeds vault liquidity", async function () {
      // Set vault liquidity to less than withdrawal amount
      const lowAmount = WITHDRAWAL_AMOUNT / 10n;
      await mockLiquidityVault.setVaultLiquidity(mockUSDT.target, lowAmount);
      
      await expect(vaultLPManager.connect(lpWithdrawService).batchWithdrawForLPs(
        [user1Address, user2Address],
        [mockUSDC.target, mockUSDT.target],
        [WITHDRAWAL_AMOUNT / 2n, WITHDRAWAL_AMOUNT / 2n]
      )).to.be.revertedWith("Insufficient vault liquidity");
    });

    it("should revert when native token transfer fails in batch", async function () {
      // Create a contract that rejects ETH transfers
      const NonPayableContractFactory = await ethers.getContractFactory("NonPayableRecipient");
      const nonPayableContract = await NonPayableContractFactory.deploy();
      await nonPayableContract.waitForDeployment();
      
      await expect(vaultLPManager.connect(lpWithdrawService).batchWithdrawForLPs(
        [user1Address, await nonPayableContract.getAddress()],
        [mockUSDC.target, NATIVE_ADDRESS],
        [WITHDRAWAL_AMOUNT / 2n, WITHDRAWAL_AMOUNT / 2n]
      )).to.be.revertedWith("Native token transfer failed");
    });
  });

  describe("getVaultLiquidity", function () {
    it("should return correct vault liquidity", async function () {
      const liquidity = await vaultLPManager.getVaultLiquidity(mockUSDC.target);
      expect(liquidity).to.equal(WITHDRAWAL_AMOUNT);
    });

    it("should return correct liquidity for native token", async function () {
      const liquidity = await vaultLPManager.getVaultLiquidity(NATIVE_ADDRESS);
      expect(liquidity).to.equal(WITHDRAWAL_AMOUNT);
    });
  });

  describe("receive function", function () {
    it("should accept ETH transfers", async function () {
      const transferAmount = ethers.parseEther("1");
      const initialBalance = await ethers.provider.getBalance(vaultLPManager.target);
      
      // Send ETH to the contract
      await owner.sendTransaction({
        to: vaultLPManager.target,
        value: transferAmount
      });
      
      const finalBalance = await ethers.provider.getBalance(vaultLPManager.target);
      expect(finalBalance - initialBalance).to.equal(transferAmount);
    });
  });

  describe("Vault Manager Functions", function () {
    it("should allow adding a vault manager", async function () {
      await vaultLPManager.connect(vaultManager).addVaultManager(user1Address);
      expect(await vaultLPManager.isVaultManager(user1Address)).to.be.true;
    });

    it("should allow removing a vault manager", async function () {
      // First add a vault manager
      await vaultLPManager.connect(vaultManager).addVaultManager(user1Address);
      expect(await vaultLPManager.isVaultManager(user1Address)).to.be.true;
      
      // Then remove it
      await vaultLPManager.connect(vaultManager).removeVaultManager(user1Address);
      expect(await vaultLPManager.isVaultManager(user1Address)).to.be.false;
    });

    it("should emit VaultManagerAdded event", async function () {
      await expect(vaultLPManager.connect(vaultManager).addVaultManager(user1Address))
        .to.emit(vaultLPManager, "VaultManagerAdded")
        .withArgs(user1Address);
    });

    it("should emit VaultManagerRemoved event", async function () {
      // First add a vault manager
      await vaultLPManager.connect(vaultManager).addVaultManager(user1Address);
      
      // Then remove it
      await expect(vaultLPManager.connect(vaultManager).removeVaultManager(user1Address))
        .to.emit(vaultLPManager, "VaultManagerRemoved")
        .withArgs(user1Address);
    });

    it("should revert when non-vault manager tries to add a vault manager", async function () {
      await expect(vaultLPManager.connect(user1).addVaultManager(user2Address))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should revert when non-vault manager tries to remove a vault manager", async function () {
      await expect(vaultLPManager.connect(user1).removeVaultManager(vaultManagerAddress))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should revert when trying to add invalid address as vault manager", async function () {
      await expect(vaultLPManager.connect(vaultManager).addVaultManager(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid vault manager address");
    });

    it("should revert when trying to add existing vault manager", async function () {
      await expect(vaultLPManager.connect(vaultManager).addVaultManager(vaultManagerAddress))
        .to.be.revertedWith("Address is already a vault manager");
    });

    it("should revert when trying to remove self as vault manager", async function () {
      await expect(vaultLPManager.connect(vaultManager).removeVaultManager(vaultManagerAddress))
        .to.be.revertedWith("Cannot remove self as vault manager");
    });

    it("should revert when trying to remove non-existent vault manager", async function () {
      await expect(vaultLPManager.connect(vaultManager).removeVaultManager(user1Address))
        .to.be.revertedWith("Address is not a vault manager");
    });
  });

  describe("depositForLP", function () {
    beforeEach(async function () {
      // Mint some tokens to the users for depositing
      await mockUSDC.mint(user1Address, WITHDRAWAL_AMOUNT);
      await mockUSDT.mint(user1Address, WITHDRAWAL_AMOUNT);
      await mockUSDC.mint(user2Address, WITHDRAWAL_AMOUNT);
      
      // Approve tokens for the vault LP manager
      await mockUSDC.connect(user1).approve(vaultLPManager.target, WITHDRAWAL_AMOUNT);
      await mockUSDT.connect(user1).approve(vaultLPManager.target, WITHDRAWAL_AMOUNT);
      await mockUSDC.connect(user2).approve(vaultLPManager.target, WITHDRAWAL_AMOUNT);
    });

    it("should deposit ERC20 tokens for LP", async function () {
      // Before deposit
      const vaultBalanceBefore = await mockUSDC.balanceOf(mockLiquidityVault.target);
      const userBalanceBefore = await mockUSDC.balanceOf(user1Address);
      
      // Perform deposit
      await vaultLPManager.connect(user1).depositForLP(
        user1Address,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT,
        1 // Chain ID
      );
      
      // After deposit
      const vaultBalanceAfter = await mockUSDC.balanceOf(mockLiquidityVault.target);
      const userBalanceAfter = await mockUSDC.balanceOf(user1Address);
      
      // Verify the tokens were transferred from user to vault
      expect(userBalanceBefore - userBalanceAfter).to.equal(WITHDRAWAL_AMOUNT);
      expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(WITHDRAWAL_AMOUNT);
    });

    it("should emit LPDepositInitiated event for ERC20 tokens", async function () {
      await expect(vaultLPManager.connect(user1).depositForLP(
        user1Address,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT,
        1 // Chain ID
      )).to.emit(vaultLPManager, "LPDepositInitiated")
        .withArgs(user1Address, mockUSDC.target, 1, WITHDRAWAL_AMOUNT);
    });

    it("should deposit native tokens for LP", async function () {
      // Before deposit
      const vaultBalanceBefore = await ethers.provider.getBalance(mockLiquidityVault.target);
      
      // Perform deposit
      await vaultLPManager.connect(user1).depositForLP(
        user1Address,
        NATIVE_ADDRESS,
        WITHDRAWAL_AMOUNT,
        1, // Chain ID
        { value: WITHDRAWAL_AMOUNT }
      );
      
      // After deposit
      const vaultBalanceAfter = await ethers.provider.getBalance(mockLiquidityVault.target);
      
      expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(WITHDRAWAL_AMOUNT);
    });

    it("should emit LPDepositInitiated event for native tokens", async function () {
      await expect(vaultLPManager.connect(user1).depositForLP(
        user1Address,
        NATIVE_ADDRESS,
        WITHDRAWAL_AMOUNT,
        1, // Chain ID
        { value: WITHDRAWAL_AMOUNT }
      )).to.emit(vaultLPManager, "LPDepositInitiated")
        .withArgs(user1Address, NATIVE_ADDRESS, 1, WITHDRAWAL_AMOUNT);
    });

    it("should allow any user to deposit (not just vault manager)", async function () {
      // Regular user (not vault manager) should be able to deposit
      await expect(vaultLPManager.connect(user2).depositForLP(
        user2Address,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT,
        1
      )).to.not.be.reverted;
    });

    it("should revert when LP address is zero", async function () {
      await expect(vaultLPManager.connect(user1).depositForLP(
        ethers.ZeroAddress,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT,
        1
      )).to.be.revertedWith("Invalid LP address");
    });

    it("should revert when amount is zero", async function () {
      await expect(vaultLPManager.connect(user1).depositForLP(
        user1Address,
        mockUSDC.target,
        0,
        1
      )).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert when native token amount doesn't match msg.value", async function () {
      await expect(vaultLPManager.connect(user1).depositForLP(
        user1Address,
        NATIVE_ADDRESS,
        WITHDRAWAL_AMOUNT,
        1,
        { value: WITHDRAWAL_AMOUNT / 2n }
      )).to.be.revertedWith("Native token amount mismatch");
    });

    it("should revert when ERC20 token transfer fails", async function () {
      // Try to deposit without approval
      await mockUSDC.connect(user1).approve(vaultLPManager.target, 0); // Reset allowance to 0
      
      await expect(vaultLPManager.connect(user1).depositForLP(
        user1Address,
        mockUSDC.target,
        WITHDRAWAL_AMOUNT,
        1
      )).to.be.reverted; // SafeERC20 will revert but with a different error message
    });
  });
});