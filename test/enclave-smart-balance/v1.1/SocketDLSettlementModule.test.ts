import { expect } from "chai";
import { ethers } from "hardhat";
import { SocketDLSettlementModule } from "../../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SocketDLSettlementModule", function () {
  let settlementModule: SocketDLSettlementModule;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let mockVault: SignerWithAddress;
  let mockSocket: SignerWithAddress;
  let mockSwitchboard: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2, mockVault, mockSocket, mockSwitchboard] = await ethers.getSigners();

    const SettlementModule = await ethers.getContractFactory("SocketDLSettlementModule");
    settlementModule = await SettlementModule.deploy(
      mockVault.address,
      mockSocket.address,
      mockSwitchboard.address,
      mockSwitchboard.address,
      100000, // messageGasLimit
      10 // maxBatchSize
    );
  });

  describe("ETH Handling", function () {
    it("should be able to receive ETH", async function () {
      const amount = ethers.parseEther("1.0");
      
      // Send ETH to the contract
      await owner.sendTransaction({
        to: settlementModule.target,
        value: amount
      });

      const contractBalance = await ethers.provider.getBalance(settlementModule.target);
      expect(contractBalance).to.equal(amount);
    });

    it("should have correct initial ETH balance", async function () {
      const contractBalance = await ethers.provider.getBalance(settlementModule.target);
      expect(contractBalance).to.equal(0);
    });

    it("should maintain ETH balance after multiple deposits", async function () {
      const amount1 = ethers.parseEther("1.0");
      const amount2 = ethers.parseEther("0.5");
      
      // Send first ETH deposit
      await owner.sendTransaction({
        to: settlementModule.target,
        value: amount1
      });

      // Send second ETH deposit
      await user1.sendTransaction({
        to: settlementModule.target,
        value: amount2
      });

      const contractBalance = await ethers.provider.getBalance(settlementModule.target);
      expect(contractBalance).to.equal(amount1 + amount2);
    });

    it("should handle ETH deposits from multiple senders", async function () {
      const amount = ethers.parseEther("0.1");
      
      // Send ETH from owner
      await owner.sendTransaction({
        to: settlementModule.target,
        value: amount
      });

      // Send ETH from user1
      await user1.sendTransaction({
        to: settlementModule.target,
        value: amount
      });

      // Send ETH from user2
      await user2.sendTransaction({
        to: settlementModule.target,
        value: amount
      });

      const contractBalance = await ethers.provider.getBalance(settlementModule.target);
      expect(contractBalance).to.equal(amount * 3n);
    });
    
  });

  describe("ETH Withdrawal", function () {
    it("should allow owner to withdraw ETH", async function () {
      const depositAmount = ethers.parseEther("1.0");
      const withdrawAmount = ethers.parseEther("0.5");
      
      // First deposit some ETH
      await owner.sendTransaction({
        to: settlementModule.target,
        value: depositAmount
      });
      
      // Withdraw ETH
      //@ts-ignore
      const tx = await settlementModule.connect(owner).withdrawETH(owner.address, withdrawAmount);
      await tx.wait();
      
      // Check contract balance is reduced
      const contractBalance = await ethers.provider.getBalance(settlementModule.target);
      expect(contractBalance).to.equal(depositAmount - withdrawAmount);
    });

    it("should not allow non-owner to withdraw ETH", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      // First deposit some ETH
      await owner.sendTransaction({
        to: settlementModule.target,
        value: depositAmount
      });

      // Try to withdraw as non-owner
      await expect(
        //@ts-ignore
        settlementModule.connect(user1).withdrawETH(user1.address, ethers.parseEther("0.5"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow withdrawal to zero address", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      // First deposit some ETH
      await owner.sendTransaction({
        to: settlementModule.target,
        value: depositAmount
      });

      // Try to withdraw to zero address
      await expect(
        //@ts-ignore
        settlementModule.connect(owner).withdrawETH(ethers.ZeroAddress, ethers.parseEther("0.5"))
      ).to.be.revertedWith("Invalid recipient address");
    });

    it("should not allow withdrawal of zero amount", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      // First deposit some ETH
      await owner.sendTransaction({
        to: settlementModule.target,
        value: depositAmount
      });

      // Try to withdraw zero amount
      await expect(
        //@ts-ignore
        settlementModule.connect(owner).withdrawETH(owner.address, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should not allow withdrawal of more than contract balance", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      // First deposit some ETH
      await owner.sendTransaction({
        to: settlementModule.target,
        value: depositAmount
      });

      // Try to withdraw more than balance
      await expect(
        //@ts-ignore
        settlementModule.connect(owner).withdrawETH(owner.address, ethers.parseEther("2.0"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("should emit ETHWithdrawn event on successful withdrawal", async function () {
      const depositAmount = ethers.parseEther("1.0");
      const withdrawAmount = ethers.parseEther("0.5");
      
      // First deposit some ETH
      await owner.sendTransaction({
        to: settlementModule.target,
        value: depositAmount
      });

      // Withdraw ETH and check event
      await expect(
        //@ts-ignore
        settlementModule.connect(owner).withdrawETH(owner.address, withdrawAmount)
      ).to.emit(settlementModule, "ETHWithdrawn")
        .withArgs(owner.address, withdrawAmount);
    });
  });
});
