const { expect } = require("chai");
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("TwitterVault", function () {
  let twitterVault: Contract;
  let mockToken: Contract;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let addresses: { [key: string]: string };

  const depositAmount = ethers.parseEther("100");

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();
    
    // Store addresses for easier access
    addresses = {
      owner: await owner.getAddress(),
      user1: await user1.getAddress(),
      user2: await user2.getAddress()
    };

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockUSDC");
    //@ts-ignore
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Deploy TwitterVault
    const TwitterVault = await ethers.getContractFactory("TwitterVault");
    //@ts-ignore
    twitterVault = await TwitterVault.deploy();
    await twitterVault.waitForDeployment();

    // Mint tokens and send to vault
    await mockToken.mint(twitterVault.target, depositAmount);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await twitterVault.owner()).to.equal(addresses.owner);
    });
  });

  describe("withdrawToken", function () {
    it("Should allow owner to withdraw tokens", async function () {
      const withdrawAmount = ethers.parseEther("50");
      
      await expect(twitterVault.withdrawToken(
        mockToken.target,
        addresses.user1,
        withdrawAmount
      ))
        .to.emit(twitterVault, "TokenWithdrawn")
        .withArgs(mockToken.target, addresses.user1, withdrawAmount);

      expect(await mockToken.balanceOf(addresses.user1)).to.equal(withdrawAmount);
    });

    it("Should allow withdrawal of all tokens", async function () {
      const vaultBalance = await mockToken.balanceOf(twitterVault.target);
      
      await twitterVault.withdrawToken(
        mockToken.target,
        addresses.user1,
        vaultBalance
      );

      expect(await mockToken.balanceOf(twitterVault.target)).to.equal(0);
      expect(await mockToken.balanceOf(addresses.user1)).to.equal(vaultBalance);
    });

    it("Should revert if called by non-owner", async function () {
      await expect(
        //@ts-ignore
        twitterVault.connect(user1).withdrawToken(
          mockToken.target,
          addresses.user1,
          depositAmount
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if token address is zero", async function () {
      await expect(
        twitterVault.withdrawToken(
          ethers.ZeroAddress,
          addresses.user1,
          depositAmount
        )
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should revert if recipient address is zero", async function () {
      await expect(
        twitterVault.withdrawToken(
          mockToken.target,
          ethers.ZeroAddress,
          depositAmount
        )
      ).to.be.revertedWith("Invalid recipient address");
    });

    it("Should revert if amount is zero", async function () {
      await expect(
        twitterVault.withdrawToken(
          mockToken.target,
          addresses.user1,
          0
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should revert if trying to withdraw more than balance", async function () {
      const excessAmount = depositAmount + ethers.parseEther("1");
      
      await expect(
        twitterVault.withdrawToken(
          mockToken.target,
          addresses.user1,
          excessAmount
        )
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should handle multiple withdrawals correctly", async function () {
      const firstAmount = ethers.parseEther("30");
      const secondAmount = ethers.parseEther("20");
      
      // First withdrawal
      await twitterVault.withdrawToken(
        mockToken.target,
        addresses.user1,
        firstAmount
      );
      
      // Second withdrawal
      await twitterVault.withdrawToken(
        mockToken.target,
        addresses.user2,
        secondAmount
      );

      expect(await mockToken.balanceOf(addresses.user1)).to.equal(firstAmount);
      expect(await mockToken.balanceOf(addresses.user2)).to.equal(secondAmount);
      expect(await mockToken.balanceOf(twitterVault.target))
        .to.equal(depositAmount - firstAmount - secondAmount);
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      await twitterVault.transferOwnership(addresses.user1);
      expect(await twitterVault.owner()).to.equal(addresses.user1);
    });

    it("Should allow new owner to withdraw tokens", async function () {
      await twitterVault.transferOwnership(addresses.user1);
      
      await expect(
        //@ts-ignore
        twitterVault.connect(user1).withdrawToken(
          mockToken.target,
          addresses.user2,
          depositAmount
        )
      ).to.not.be.reverted;
    });

    it("Should prevent old owner from withdrawing after ownership transfer", async function () {
      await twitterVault.transferOwnership(addresses.user1);
      
      await expect(
        twitterVault.withdrawToken(
          mockToken.target,
          addresses.user2,
          depositAmount
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
