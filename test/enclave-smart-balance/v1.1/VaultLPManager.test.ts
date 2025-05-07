import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("VaultLPManager", function () {
  let vaultLPManager: Contract;
  let mockToken: Contract;
  let mockLiquidityVault: Contract;
  let owner: Signer;
  let rebalancer: Signer;
  let lpWithdrawService: Signer;
  let user1: Signer;
  let addresses: { [key: string]: string };

  const tokenAmount = ethers.parseEther("100");

  beforeEach(async function () {
    console.log("1. Getting signers...");
    [owner, rebalancer, lpWithdrawService, user1] = await ethers.getSigners();
    
    console.log("2. Setting up addresses...");
    addresses = {
      owner: await owner.getAddress(),
      rebalancer: await rebalancer.getAddress(),
      lpWithdrawService: await lpWithdrawService.getAddress(),
      user1: await user1.getAddress()
    };

    console.log("3. Deploying MockToken...");
    const TestMockUSDC = await ethers.getContractFactory("TestMockUSDC");
    mockToken = await TestMockUSDC.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    console.log("4. Deploying MockLiquidityVault...");
    const MockLiquidityVault = await ethers.getContractFactory("MockEnclaveVirtualLiquidityVault");
    mockLiquidityVault = await MockLiquidityVault.deploy();
    await mockLiquidityVault.waitForDeployment();

    console.log("5. Deploying VaultLPManager...");
    const VaultLPManager = await ethers.getContractFactory("VaultLPManager");
    vaultLPManager = await VaultLPManager.deploy(
      await owner.getAddress(),
      await mockLiquidityVault.getAddress(),
      await rebalancer.getAddress(),
      await lpWithdrawService.getAddress()
    );
    await vaultLPManager.waitForDeployment();

    // Mint some tokens to the mock vault
    await mockToken.mint(mockLiquidityVault.target, tokenAmount * 2n);
  });

  describe("Initialization", function () {
    it("should be initialized with correct values", async function () {
      expect(await vaultLPManager.liquidityVault()).to.equal(await mockLiquidityVault.getAddress());
      expect(await vaultLPManager.rebalancer()).to.equal(await rebalancer.getAddress());
      expect(await vaultLPManager.lpWithdrawService()).to.equal(await lpWithdrawService.getAddress());
      
      // Check if owner is a vault manager
      expect(await vaultLPManager.isVaultManager(addresses.owner)).to.be.true;
    });
  });

  describe("Access Control", function () {
    it("should allow only vault manager to add a vault manager", async function () {
      await vaultLPManager.connect(owner).addVaultManager(addresses.user1);
      expect(await vaultLPManager.isVaultManager(addresses.user1)).to.be.true;
    });

    it("should prevent non-vault managers from adding a vault manager", async function () {
      await expect(vaultLPManager.connect(user1).addVaultManager(addresses.user1))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should allow only vault manager to remove a vault manager", async function () {
      await vaultLPManager.connect(owner).addVaultManager(addresses.user1);
      expect(await vaultLPManager.isVaultManager(addresses.user1)).to.be.true;
      
      await vaultLPManager.connect(owner).removeVaultManager(addresses.user1);
      expect(await vaultLPManager.isVaultManager(addresses.user1)).to.be.false;
    });

    it("should prevent removing self as vault manager", async function () {
      await expect(vaultLPManager.connect(owner).removeVaultManager(addresses.owner))
        .to.be.revertedWith("Cannot remove self as vault manager");
    });

    it("should allow vault manager to update rebalancer", async function () {
      await vaultLPManager.connect(owner).setRebalancer(addresses.user1);
      expect(await vaultLPManager.rebalancer()).to.equal(addresses.user1);
    });

    it("should prevent non-vault managers from updating rebalancer", async function () {
      await expect(vaultLPManager.connect(user1).setRebalancer(addresses.user1))
        .to.be.revertedWith("Caller is not a vault manager");
    });

    it("should allow vault manager to update LP withdraw service", async function () {
      await vaultLPManager.connect(owner).setLPWithdrawService(addresses.user1);
      expect(await vaultLPManager.lpWithdrawService()).to.equal(addresses.user1);
    });

    it("should prevent non-vault managers from updating LP withdraw service", async function () {
      await expect(vaultLPManager.connect(user1).setLPWithdrawService(addresses.user1))
        .to.be.revertedWith("Caller is not a vault manager");
    });
  });

  describe("Rebalance Functionality", function () {
    it("should allow rebalancer to call rebalanceToChain", async function () {
      // Setup mock vault to respond correctly to withdrawToken
      await mockLiquidityVault.setWithdrawSuccess(true);

      const targetChainId = 11155111; // Sepolia testnet
      const bridgeData = ethers.toUtf8Bytes("bridge data");
      
      await expect(vaultLPManager.connect(rebalancer).rebalanceToChain(
        mockToken.target,
        tokenAmount,
        targetChainId,
        bridgeData
      ))
        .to.emit(vaultLPManager, "Rebalanced")
        .withArgs(mockToken.target, tokenAmount, targetChainId, bridgeData);
    });

    it("should prevent non-rebalancers from calling rebalanceToChain", async function () {
      const targetChainId = 11155111; // Sepolia testnet
      const bridgeData = ethers.toUtf8Bytes("bridge data");
      
      await expect(vaultLPManager.connect(user1).rebalanceToChain(
        mockToken.target,
        tokenAmount,
        targetChainId,
        bridgeData
      ))
        .to.be.revertedWith("Caller is not the rebalancer");
    });

    it("should revert if the liquidityVault.withdrawToken fails", async function () {
      await mockLiquidityVault.setWithdrawSuccess(false);
      
      const targetChainId = 11155111; // Sepolia testnet
      const bridgeData = ethers.toUtf8Bytes("bridge data");
      
      await expect(vaultLPManager.connect(rebalancer).rebalanceToChain(
        mockToken.target,
        tokenAmount,
        targetChainId,
        bridgeData
      ))
        .to.be.revertedWith("Withdrawal failed");
    });
  });

  describe("LP Withdrawal Functionality", function () {
    it("should allow LP withdraw service to call withdrawForLP", async function () {
      // Setup mock vault to respond correctly to withdrawToken
      await mockLiquidityVault.setWithdrawSuccess(true);
      
      await mockToken.mint(vaultLPManager.target, tokenAmount);
      
      await expect(vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        addresses.user1,
        mockToken.target,
        tokenAmount
      ))
        .to.emit(vaultLPManager, "LPWithdrawal")
        .withArgs(addresses.user1, mockToken.target, tokenAmount);
    });

    it("should prevent non-LP withdraw services from calling withdrawForLP", async function () {
      await expect(vaultLPManager.connect(user1).withdrawForLP(
        addresses.user1,
        mockToken.target,
        tokenAmount
      ))
        .to.be.revertedWith("Caller is not the LP withdraw service");
    });

    it("should revert if the liquidityVault.withdrawToken fails", async function () {
      await mockLiquidityVault.setWithdrawSuccess(false);
      
      await expect(vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        addresses.user1,
        mockToken.target,
        tokenAmount
      ))
        .to.be.revertedWith("Withdrawal failed");
    });

    it("should revert with invalid LP address", async function () {
      await expect(vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        ethers.ZeroAddress,
        mockToken.target,
        tokenAmount
      ))
        .to.be.revertedWith("Invalid LP address");
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

    it("should allow rebalancing native tokens", async function() {
      // Setup mock vault to respond correctly to withdrawToken
      await mockLiquidityVault.setWithdrawSuccess(true);
      
      const targetChainId = 11155111; // Sepolia testnet
      const bridgeData = ethers.toUtf8Bytes("bridge data");
      
      await expect(vaultLPManager.connect(rebalancer).rebalanceToChain(
        await mockLiquidityVault.NATIVE_ADDRESS(),
        nativeAmount,
        targetChainId,
        bridgeData
      ))
        .to.emit(vaultLPManager, "Rebalanced")
        .withArgs(await mockLiquidityVault.NATIVE_ADDRESS(), nativeAmount, targetChainId, bridgeData);
    });

    it("should handle native token withdrawals for LPs", async function() {
      // Setup mock vault to respond correctly to withdrawToken
      await mockLiquidityVault.setWithdrawSuccess(true);
      
      // Fund the VaultLPManager
      await owner.sendTransaction({
        to: vaultLPManager.target,
        value: nativeAmount
      });
      
      const initialBalance = await ethers.provider.getBalance(addresses.user1);
      
      await vaultLPManager.connect(lpWithdrawService).withdrawForLP(
        addresses.user1,
        await mockLiquidityVault.NATIVE_ADDRESS(),
        nativeAmount
      );
      
      const finalBalance = await ethers.provider.getBalance(addresses.user1);
      expect(finalBalance - initialBalance).to.equal(nativeAmount);
    });
  });

  it("should deploy the contract", async function () {
    // Simple test to check deployment was successful
    expect(await vaultLPManager.liquidityVault()).to.equal(await mockLiquidityVault.getAddress());
    expect(await vaultLPManager.rebalancer()).to.equal(await rebalancer.getAddress());
    expect(await vaultLPManager.lpWithdrawService()).to.equal(await lpWithdrawService.getAddress());
  });
});

// Contract needed for the tests
// We'll define a mock for the EnclaveVirtualLiquidityVault contract
// Add this mock contract to contracts/mocks/ directory
/* 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockEnclaveVirtualLiquidityVault {
    address constant public NATIVE_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    bool public withdrawSuccess = true;

    function setWithdrawSuccess(bool _success) external {
        withdrawSuccess = _success;
    }

    function withdrawToken(address _tokenAddress, uint256 _amount) external returns (bool) {
        if (!withdrawSuccess) {
            revert("Withdrawal failed");
        }
        
        if (_tokenAddress == NATIVE_ADDRESS) {
            (bool success, ) = msg.sender.call{value: _amount}("");
            return success;
        }
        
        return true;
    }

    receive() external payable {}
}
*/ 