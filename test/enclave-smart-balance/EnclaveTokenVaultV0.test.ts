const { expect } = require("chai");

import { ethers } from "hardhat";
import { AbiCoder } from "ethers";

describe("EnclaveTokenVaultV0", function () {
  let EnclaveTokenVaultV0: any, enclaveTokenVault: any, owner: any, addr1: any, addr2: any, addr3: any;
  let ERC20: any, mockToken: any;

  const abiCoder = new AbiCoder();

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy mock ERC20 token
    ERC20 = await ethers.getContractFactory("MockUSDC");
    mockToken = await ERC20.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Deploy EnclaveTokenVaultV0
    EnclaveTokenVaultV0 = await ethers.getContractFactory("EnclaveTokenVaultV0");
    enclaveTokenVault = await EnclaveTokenVaultV0.deploy();
    await enclaveTokenVault.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the deployer as the initial vault manager", async function () {
      expect(await enclaveTokenVault.isVaultManager(owner.address)).to.be.true;
    });
  });

  describe("Vault Manager Functions", function () {
    describe("addVaultManager", function () {
      it("Should allow a vault manager to add a new vault manager", async function () {
        await enclaveTokenVault.addVaultManager(addr1.address);
        expect(await enclaveTokenVault.isVaultManager(addr1.address)).to.be.true;
      });

      it("Should emit VaultManagerAdded event", async function () {
        await expect(enclaveTokenVault.addVaultManager(addr1.address))
          .to.emit(enclaveTokenVault, "VaultManagerAdded")
          .withArgs(addr1.address);
      });

      it("Should revert if caller is not a vault manager", async function () {
        await expect(enclaveTokenVault.connect(addr1).addVaultManager(addr2.address))
          .to.be.revertedWith("Caller is not a vault manager");
      });

      it("Should revert if adding zero address", async function () {
        await expect(enclaveTokenVault.addVaultManager(ethers.ZeroAddress))
          .to.be.revertedWith("Invalid vault manager address");
      });

      it("Should revert if address is already a vault manager", async function () {
        await enclaveTokenVault.addVaultManager(addr1.address);
        await expect(enclaveTokenVault.addVaultManager(addr1.address))
          .to.be.revertedWith("Address is already a vault manager");
      });
    });

    describe("removeVaultManager", function () {
      beforeEach(async function () {
        await enclaveTokenVault.addVaultManager(addr1.address);
      });

      it("Should allow a vault manager to remove another vault manager", async function () {
        await enclaveTokenVault.removeVaultManager(addr1.address);
        expect(await enclaveTokenVault.isVaultManager(addr1.address)).to.be.false;
      });

      it("Should emit VaultManagerRemoved event", async function () {
        await expect(enclaveTokenVault.removeVaultManager(addr1.address))
          .to.emit(enclaveTokenVault, "VaultManagerRemoved")
          .withArgs(addr1.address);
      });

      it("Should revert if caller is not a vault manager", async function () {
        await expect(enclaveTokenVault.connect(addr2).removeVaultManager(addr1.address))
          .to.be.revertedWith("Caller is not a vault manager");
      });

      it("Should revert if address is not a vault manager", async function () {
        await expect(enclaveTokenVault.removeVaultManager(addr2.address))
          .to.be.revertedWith("Address is not a vault manager");
      });

      it("Should revert if trying to remove self", async function () {
        await expect(enclaveTokenVault.removeVaultManager(owner.address))
          .to.be.revertedWith("Cannot remove self as vault manager");
      });
    });
  });

  describe("User Functions", function () {
    const depositAmount = ethers.parseEther("100");

    beforeEach(async function () {
      // Mint tokens to addr1
      await mockToken.mint(addr1.address, depositAmount);
      // Approve vault to spend tokens
      await mockToken.connect(addr1).approve(enclaveTokenVault.target, depositAmount);
    });

    describe("deposit", function () {
      it("Should allow users to deposit tokens", async function () {
        await enclaveTokenVault.connect(addr1).deposit(mockToken.target, depositAmount);
        expect(await enclaveTokenVault.deposits(mockToken.target, addr1.address)).to.equal(depositAmount);
      });

      it("Should emit Deposited event", async function () {
        await expect(enclaveTokenVault.connect(addr1).deposit(mockToken.target, depositAmount))
          .to.emit(enclaveTokenVault, "Deposited")
          .withArgs(addr1.address, mockToken.target, depositAmount);
      });

      it("Should revert if amount is 0", async function () {
        await expect(enclaveTokenVault.connect(addr1).deposit(mockToken.target, 0))
          .to.be.revertedWith("Amount must be greater than 0");
      });

      it("Should revert if transfer fails", async function () {
        await mockToken.connect(addr1).approve(enclaveTokenVault.target, 0); // Remove approval
        await expect(enclaveTokenVault.connect(addr1).deposit(mockToken.target, depositAmount))
          .to.be.revertedWith("ERC20: insufficient allowance");
      });
    });

    describe("withdraw", function () {
      beforeEach(async function () {
        await enclaveTokenVault.connect(addr1).deposit(mockToken.target, depositAmount);
      });

      it("Should allow users to withdraw tokens", async function () {
        await enclaveTokenVault.connect(addr1).withdraw(mockToken.target, depositAmount);
        expect(await enclaveTokenVault.deposits(mockToken.target, addr1.address)).to.equal(0);
        expect(await mockToken.balanceOf(addr1.address)).to.equal(depositAmount);
      });

      it("Should emit Withdrawn event", async function () {
        await expect(enclaveTokenVault.connect(addr1).withdraw(mockToken.target, depositAmount))
          .to.emit(enclaveTokenVault, "Withdrawn")
          .withArgs(addr1.address, mockToken.target, depositAmount);
      });

      it("Should revert if amount is 0", async function () {
        await expect(enclaveTokenVault.connect(addr1).withdraw(mockToken.target, 0))
          .to.be.revertedWith("Amount must be greater than 0");
      });

      it("Should revert if insufficient balance", async function () {
        await expect(enclaveTokenVault.connect(addr1).withdraw(mockToken.target, depositAmount + 1n))
          .to.be.revertedWith("Insufficient balance");
      });
    });
  });

  describe("Vault Manager Functions", function () {
    const depositAmount = ethers.parseEther("100");

    beforeEach(async function () {

      // Log mocktoken address
      console.log("A. Mock token address: %s", mockToken.target);
      console.log("B. Enclave token vault address: %s", enclaveTokenVault.target);

      await mockToken.mint(addr1.address, depositAmount);
      await mockToken.connect(addr1).approve(enclaveTokenVault.target, depositAmount);
      await enclaveTokenVault.connect(addr1).deposit(mockToken.target, depositAmount);

      console.log("C. Deposit amount: %s", await enclaveTokenVault.deposits(mockToken.target, addr1.address));
    });

    describe("claim", function () {
      it("Should allow vault manager to claim tokens", async function () {
        const proof = abiCoder.encode(['address'], [addr1.address]);
        console.log("D. Proof: %s", proof);
        await enclaveTokenVault.claim(mockToken.target, depositAmount, proof);
        expect(await enclaveTokenVault.deposits(mockToken.target, addr1.address)).to.equal(0);
        expect(await mockToken.balanceOf(owner.address)).to.equal(depositAmount);
      });

      it("Should emit Claimed event", async function () {
        const proof = abiCoder.encode(['address'], [addr1.address]);
        await expect(enclaveTokenVault.claim(mockToken.target, depositAmount, proof))
          .to.emit(enclaveTokenVault, "Claimed")
          .withArgs(owner.address, mockToken.target, depositAmount, addr1.address);
      });

      it("Should revert if caller is not a vault manager", async function () {
        const proof = abiCoder.encode(['address'], [addr1.address]);
        await expect(enclaveTokenVault.connect(addr2).claim(mockToken.target, depositAmount, proof))
          .to.be.revertedWith("Caller is not a vault manager");
      });

      it("Should revert if amount is 0", async function () {
        const proof = abiCoder.encode(['address'], [addr1.address]);
        await expect(enclaveTokenVault.claim(mockToken.target, 0, proof))
          .to.be.revertedWith("Amount must be greater than 0");
      });

      it("Should revert if insufficient balance", async function () {
        const proof = abiCoder.encode(['address'], [addr1.address]);
        await expect(enclaveTokenVault.claim(mockToken.target, depositAmount + 1n, proof))
          .to.be.revertedWith("Insufficient balance");
      });

      it("Should revert if transfer fails", async function () {
        // Mock a transfer failure by using a non-compliant token
        const NonCompliantToken = await ethers.getContractFactory("MockUSDC");
        const nonCompliantToken = await NonCompliantToken.deploy("Non Compliant Token", "NCT");

        // @ts-ignore
        await nonCompliantToken.waitForDeployment();


        // @ts-ignore
        await nonCompliantToken.mint(addr1.address, depositAmount);
        // @ts-ignore
        await nonCompliantToken.connect(addr1).approve(enclaveTokenVault.address, depositAmount);
        await enclaveTokenVault.connect(addr1).deposit(nonCompliantToken.target, depositAmount);

        const proof = abiCoder.encode(['address'], [addr1.address]);
        await expect(enclaveTokenVault.claim(nonCompliantToken.target, depositAmount, proof))
          .to.be.revertedWith("Transfer failed");
      });
    });
  });
});

