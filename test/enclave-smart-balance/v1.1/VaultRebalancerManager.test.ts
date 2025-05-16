import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import type { MockUSDC, MockEnclaveVirtualLiquidityVault, VaultRebalancerManager, MockBridge } from "../../../typechain-types";

describe("VaultRebalancerManager", function () {
  let vaultRebalancerManager: VaultRebalancerManager;
  let mockLiquidityVault: MockEnclaveVirtualLiquidityVault;
  let mockBridge: MockBridge;
  let mockUSDC: any;
  let mockUSDT: any;
  
  let owner: any;
  let vaultManager: any;
  let rebalancer: any;
  let user1: any;
  let user2: any;
  
  let ownerAddress: string;
  let vaultManagerAddress: string;
  let rebalancerAddress: string;
  let user1Address: string;
  let user2Address: string;
  let mockBridgeAddress: string;
  
  const REBALANCE_AMOUNT = ethers.parseEther("100");
  const NATIVE_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const TARGET_CHAIN_ID = 137n; // Polygon chain ID

  beforeEach(async function () {
    [owner, vaultManager, rebalancer, user1, user2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    vaultManagerAddress = await vaultManager.getAddress();
    rebalancerAddress = await rebalancer.getAddress();
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

    // Deploy the mock bridge
    const MockBridgeFactory = await ethers.getContractFactory("MockBridge");
    mockBridge = await MockBridgeFactory.deploy() as MockBridge;
    await mockBridge.waitForDeployment();
    mockBridgeAddress = await mockBridge.getAddress();

    // Set vault liquidity
    await mockLiquidityVault.setVaultLiquidity(mockUSDC.target, REBALANCE_AMOUNT);
    await mockLiquidityVault.setVaultLiquidity(mockUSDT.target, REBALANCE_AMOUNT);
    await mockLiquidityVault.setVaultLiquidity(NATIVE_ADDRESS, REBALANCE_AMOUNT);
    
    // Send ETH to the mock vault
    await owner.sendTransaction({
      to: mockLiquidityVault.target,
      value: REBALANCE_AMOUNT
    });

    // Deploy the VaultRebalancerManager
    const VaultRebalancerManagerFactory = await ethers.getContractFactory("VaultRebalancerManager");
    vaultRebalancerManager = await VaultRebalancerManagerFactory.deploy(
      vaultManagerAddress,
      mockLiquidityVault.target,
      rebalancerAddress
    ) as VaultRebalancerManager;
    await vaultRebalancerManager.waitForDeployment();

    // Mint tokens and approve them
    await mockUSDC.mint(mockLiquidityVault.target, REBALANCE_AMOUNT);
    await mockUSDT.mint(mockLiquidityVault.target, REBALANCE_AMOUNT);

    // Set bridge success to true by default
    await mockBridge.setBridgeSuccess(true);
  });

  describe("Constructor", function () {
    it("should initialize with correct parameters", async function () {
      expect(await vaultRebalancerManager.rebalancer()).to.equal(rebalancerAddress);
      expect(await vaultRebalancerManager.liquidityVault()).to.equal(mockLiquidityVault.target);
    });

    it("should revert when initialized with zero liquidity vault address", async function () {
      const VaultRebalancerManagerFactory = await ethers.getContractFactory("VaultRebalancerManager");
      await expect(VaultRebalancerManagerFactory.deploy(
        vaultManagerAddress,
        ethers.ZeroAddress,
        rebalancerAddress
      )).to.be.revertedWith("Invalid liquidity vault address");
    });

    it("should revert when initialized with zero rebalancer address", async function () {
      const VaultRebalancerManagerFactory = await ethers.getContractFactory("VaultRebalancerManager");
      await expect(VaultRebalancerManagerFactory.deploy(
        vaultManagerAddress,
        mockLiquidityVault.target,
        ethers.ZeroAddress
      )).to.be.revertedWith("Invalid rebalancer address");
    });
  });

  describe("setRebalancer", function () {
    it("should update rebalancer address", async function () {
      await vaultRebalancerManager.connect(vaultManager).setRebalancer(user1Address);
      expect(await vaultRebalancerManager.rebalancer()).to.equal(user1Address);
    });

    it("should revert when called by non-vault manager", async function () {
      await expect(vaultRebalancerManager.connect(user1).setRebalancer(user2Address))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should revert when setting zero address", async function () {
      await expect(vaultRebalancerManager.connect(vaultManager).setRebalancer(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid rebalancer address");
    });
  });

  describe("setLiquidityVault", function () {
    it("should update liquidity vault address", async function () {
      // Deploy a new mock vault
      const MockEnclaveVirtualLiquidityVaultFactory = await ethers.getContractFactory("MockEnclaveVirtualLiquidityVault");
      const newMockVault = await MockEnclaveVirtualLiquidityVaultFactory.deploy() as MockEnclaveVirtualLiquidityVault;
      await newMockVault.waitForDeployment();

      await vaultRebalancerManager.connect(vaultManager).setLiquidityVault(newMockVault.target);
      expect(await vaultRebalancerManager.liquidityVault()).to.equal(newMockVault.target);
    });

    it("should revert when called by non-vault manager", async function () {
      const MockEnclaveVirtualLiquidityVaultFactory = await ethers.getContractFactory("MockEnclaveVirtualLiquidityVault");
      const newMockVault = await MockEnclaveVirtualLiquidityVaultFactory.deploy() as MockEnclaveVirtualLiquidityVault;
      await newMockVault.waitForDeployment();

      await expect(vaultRebalancerManager.connect(user1).setLiquidityVault(newMockVault.target))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should revert when setting zero address", async function () {
      await expect(vaultRebalancerManager.connect(vaultManager).setLiquidityVault(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid liquidity vault address");
    });
  });

  describe("rebalanceToChain", function () {
    const bridgeData = ethers.hexlify(ethers.toUtf8Bytes("bridge_data"));

    it("should rebalance ERC20 tokens with transfer and approval", async function () {
      await vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,  // transfer required
        true,  // approval required
        mockBridgeAddress,
        bridgeData
      );

      // Verify bridge was called
      expect(await mockBridge.getCallCount()).to.equal(1);
    });

    it("should rebalance ERC20 tokens with only transfer", async function () {
      await vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,  // transfer required
        false, // approval not required
        mockBridgeAddress,
        bridgeData
      );

      // Verify bridge was called
      expect(await mockBridge.getCallCount()).to.equal(1);
    });

    it("should rebalance ERC20 tokens with only approval", async function () {
      await vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        false, // transfer not required
        true,  // approval required
        mockBridgeAddress,
        bridgeData
      );

      // Verify bridge was called
      expect(await mockBridge.getCallCount()).to.equal(1);
    });

    it("should rebalance ERC20 tokens without transfer or approval", async function () {
      await vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        false, // transfer not required
        false, // approval not required
        mockBridgeAddress,
        bridgeData
      );

      // Verify bridge was called
      expect(await mockBridge.getCallCount()).to.equal(1);
    });

    it("should rebalance native tokens with transfer", async function () {
      // Reset call count
      await mockBridge.setBridgeSuccess(true);
      
      // Send some ETH to the contract first
      await owner.sendTransaction({
        to: vaultRebalancerManager.target,
        value: REBALANCE_AMOUNT
      });

      await vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        NATIVE_ADDRESS,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,  // transfer required
        false, // approval not required for native tokens
        mockBridgeAddress,
        bridgeData
      );

      // For native tokens, we can't directly check the call count because
      // the bridge is receiving a direct transfer in transferTokenAfterWithdrawal
      // and then also receiving the value in the bridge contract call
      const bridgeBalance = await ethers.provider.getBalance(mockBridgeAddress);
      expect(bridgeBalance).to.be.gt(0);
    });

    it("should emit Rebalanced event", async function () {
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,
        true,
        mockBridgeAddress,
        bridgeData
      )).to.emit(vaultRebalancerManager, "Rebalanced")
        .withArgs(mockUSDC.target, REBALANCE_AMOUNT, TARGET_CHAIN_ID, bridgeData);
    });

    it("should revert when called by non-rebalancer", async function () {
      await expect(vaultRebalancerManager.connect(user1).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,
        true,
        mockBridgeAddress,
        bridgeData
      )).to.be.revertedWith("Caller is not the rebalancer");
    });

    it("should revert with zero bridge address", async function () {
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,
        true,
        ethers.ZeroAddress,
        bridgeData
      )).to.be.revertedWith("Invalid bridge address");
    });

    it("should revert with zero amount", async function () {
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        0,
        TARGET_CHAIN_ID,
        true,
        true,
        mockBridgeAddress,
        bridgeData
      )).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert when amount exceeds vault liquidity", async function () {
      // Set vault liquidity to less than rebalance amount
      const lowAmount = REBALANCE_AMOUNT / 10n;
      await mockLiquidityVault.setVaultLiquidity(mockUSDC.target, lowAmount);
      
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,
        true,
        mockBridgeAddress,
        bridgeData
      )).to.be.revertedWith("Insufficient vault liquidity");
    });

    it("should revert when bridge call fails", async function () {
      // Set bridge to fail
      await mockBridge.setBridgeSuccess(false);
      
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,
        true,
        mockBridgeAddress,
        bridgeData
      )).to.be.revertedWith("Bridge call failed");
    });

    it("should revert when native token transfer fails", async function () {
      // Create a contract that rejects ETH transfers
      const NonPayableContractFactory = await ethers.getContractFactory("NonPayableRecipient");
      const nonPayableContract = await NonPayableContractFactory.deploy();
      await nonPayableContract.waitForDeployment();
      
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        NATIVE_ADDRESS,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,  // transfer required
        false, // approval not required
        await nonPayableContract.getAddress(),
        bridgeData
      )).to.be.revertedWith("Native token transfer failed");
    });

    it("should revert when trying to approve native tokens", async function () {
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        NATIVE_ADDRESS,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        false, // transfer not required
        true,  // approval required
        mockBridgeAddress,
        bridgeData
      )).to.be.revertedWith("Cannot approve native tokens");
    });

    it("should emit TokenTransferred event when transfer is required", async function () {
      const tx = await vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,  // transfer required
        false, // approval not required
        mockBridgeAddress,
        bridgeData
      );
      
      const receipt = await tx.wait();
      
      // Verify TokenTransferred event was emitted
      const events = receipt?.logs.filter(
        (log: any) => log.fragment && log.fragment.name === 'TokenTransferred'
      );
      
      expect(events).to.not.be.undefined;
      if (events) {
        expect(events.length).to.be.gt(0);
      }
    });
  });

  describe("transferTokenAfterWithdrawal internal function via rebalanceToChain", function () {
    const bridgeData = ethers.hexlify(ethers.toUtf8Bytes("bridge_data"));

    it("should transfer ERC20 tokens", async function () {
      const initialBalance = await mockUSDC.balanceOf(mockBridgeAddress);
      
      await vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,  // transfer required
        false, // approval not required
        mockBridgeAddress,
        bridgeData
      );
      
      const finalBalance = await mockUSDC.balanceOf(mockBridgeAddress);
      expect(finalBalance - initialBalance).to.equal(REBALANCE_AMOUNT);
    });

    it("should transfer native tokens", async function () {
      // Reset call count and bridge success
      await mockBridge.setBridgeSuccess(true);
      
      // Fund the contract with native tokens
      await owner.sendTransaction({
        to: vaultRebalancerManager.target,
        value: REBALANCE_AMOUNT * 2n
      });
      
      const initialBalance = await ethers.provider.getBalance(mockBridgeAddress);
      
      // We skip calling the bridge with empty bridge data to isolate the transfer
      await vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        NATIVE_ADDRESS,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,  // transfer required
        false, // approval not required
        mockBridgeAddress,
        "0x" // empty bridge data
      );
      
      const finalBalance = await ethers.provider.getBalance(mockBridgeAddress);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should revert when recipient is zero address", async function () {
      // Since transferTokenAfterWithdrawal is internal, we test via rebalanceToChain
      // We use zero address as the bridge address which should trigger the internal check
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,  // transfer required
        false, // approval not required
        ethers.ZeroAddress,
        bridgeData
      )).to.be.revertedWith("Invalid bridge address");
    });

    // Additional test for the zero address validation
    it("should validate recipient address before transfer in native token case", async function () {
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        NATIVE_ADDRESS,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,  // transfer required
        false, // approval not required
        ethers.ZeroAddress,
        bridgeData
      )).to.be.revertedWith("Invalid bridge address");
    });
  });

  describe("approveTokenAfterWithdrawal internal function via rebalanceToChain", function () {
    const bridgeData = ethers.hexlify(ethers.toUtf8Bytes("bridge_data"));

    it("should approve ERC20 tokens", async function () {
      await vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        false, // transfer not required
        true,  // approval required
        mockBridgeAddress,
        bridgeData
      );
      
      // Verify the allowance
      const allowance = await mockUSDC.allowance(vaultRebalancerManager.target, mockBridgeAddress);
      expect(allowance).to.equal(REBALANCE_AMOUNT);
    });

    it("should revert when approving native tokens", async function () {
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        NATIVE_ADDRESS,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        false, // transfer not required
        true,  // approval required
        mockBridgeAddress,
        bridgeData
      )).to.be.revertedWith("Cannot approve native tokens");
    });

    it("should revert when spender is zero address", async function () {
      // Since approveTokenAfterWithdrawal is internal, we test via rebalanceToChain
      // We use zero address as the bridge address which should trigger the internal check
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        false, // transfer not required
        true,  // approval required
        ethers.ZeroAddress,
        bridgeData
      )).to.be.revertedWith("Invalid bridge address");
    });
    
    // Additional test for spender validation
    it("should validate spender address before approval even when transfer is also required", async function () {
      await expect(vaultRebalancerManager.connect(rebalancer).rebalanceToChain(
        mockUSDC.target,
        REBALANCE_AMOUNT,
        TARGET_CHAIN_ID,
        true,  // transfer required
        true,  // approval required
        ethers.ZeroAddress,
        bridgeData
      )).to.be.revertedWith("Invalid bridge address");
    });
  });

  describe("getVaultLiquidity", function () {
    it("should return correct vault liquidity", async function () {
      const liquidity = await vaultRebalancerManager.getVaultLiquidity(mockUSDC.target);
      expect(liquidity).to.equal(REBALANCE_AMOUNT);
    });

    it("should return correct liquidity for native token", async function () {
      const liquidity = await vaultRebalancerManager.getVaultLiquidity(NATIVE_ADDRESS);
      expect(liquidity).to.equal(REBALANCE_AMOUNT);
    });
  });

  describe("receive function", function () {
    it("should accept ETH transfers", async function () {
      const transferAmount = ethers.parseEther("1");
      const initialBalance = await ethers.provider.getBalance(vaultRebalancerManager.target);
      
      // Send ETH to the contract
      await owner.sendTransaction({
        to: vaultRebalancerManager.target,
        value: transferAmount
      });
      
      const finalBalance = await ethers.provider.getBalance(vaultRebalancerManager.target);
      expect(finalBalance - initialBalance).to.equal(transferAmount);
    });
  });

  describe("Vault Manager Functions", function () {
    it("should allow adding a vault manager", async function () {
      await vaultRebalancerManager.connect(vaultManager).addVaultManager(user1Address);
      expect(await vaultRebalancerManager.isVaultManager(user1Address)).to.be.true;
    });

    it("should allow removing a vault manager", async function () {
      // First add a vault manager
      await vaultRebalancerManager.connect(vaultManager).addVaultManager(user1Address);
      expect(await vaultRebalancerManager.isVaultManager(user1Address)).to.be.true;
      
      // Then remove it
      await vaultRebalancerManager.connect(vaultManager).removeVaultManager(user1Address);
      expect(await vaultRebalancerManager.isVaultManager(user1Address)).to.be.false;
    });

    it("should emit VaultManagerAdded event", async function () {
      await expect(vaultRebalancerManager.connect(vaultManager).addVaultManager(user1Address))
        .to.emit(vaultRebalancerManager, "VaultManagerAdded")
        .withArgs(user1Address);
    });

    it("should emit VaultManagerRemoved event", async function () {
      // First add a vault manager
      await vaultRebalancerManager.connect(vaultManager).addVaultManager(user1Address);
      
      // Then remove it
      await expect(vaultRebalancerManager.connect(vaultManager).removeVaultManager(user1Address))
        .to.emit(vaultRebalancerManager, "VaultManagerRemoved")
        .withArgs(user1Address);
    });

    it("should revert when non-vault manager tries to add a vault manager", async function () {
      await expect(vaultRebalancerManager.connect(user1).addVaultManager(user2Address))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should revert when non-vault manager tries to remove a vault manager", async function () {
      await expect(vaultRebalancerManager.connect(user1).removeVaultManager(vaultManagerAddress))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should revert when trying to add invalid address as vault manager", async function () {
      await expect(vaultRebalancerManager.connect(vaultManager).addVaultManager(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid vault manager address");
    });

    it("should revert when trying to add existing vault manager", async function () {
      await expect(vaultRebalancerManager.connect(vaultManager).addVaultManager(vaultManagerAddress))
        .to.be.revertedWith("Address is already a vault manager");
    });

    it("should revert when trying to remove self as vault manager", async function () {
      await expect(vaultRebalancerManager.connect(vaultManager).removeVaultManager(vaultManagerAddress))
        .to.be.revertedWith("Cannot remove self as vault manager");
    });

    it("should revert when trying to remove non-existent vault manager", async function () {
      await expect(vaultRebalancerManager.connect(vaultManager).removeVaultManager(user1Address))
        .to.be.revertedWith("Address is not a vault manager");
    });
  });
}); 