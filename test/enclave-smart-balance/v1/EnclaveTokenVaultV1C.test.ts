const { expect } = require("chai");

import { ethers } from "hardhat";
import { AbiCoder } from "ethers";
import { IGateway } from "../../../typechain-types";

describe("EnclaveTokenVaultV1C", function () {
  let EnclaveTokenVault: any, enclaveTokenVault: any, owner: any, addr1: any, addr2: any, addr3: any;
  let ERC20: any, mockToken: any, mockGateway: any;
  const routerRNSAddress = "router.rns";
  const routerChainId = "chain.123";

  const abiCoder = new AbiCoder();

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy mock ERC20 token
    ERC20 = await ethers.getContractFactory("MockUSDC");
    mockToken = await ERC20.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Deploy mock Gateway
    const MockGateway = await ethers.getContractFactory("MockGateway");
    mockGateway = await MockGateway.deploy();
    await mockGateway.waitForDeployment();

    // Deploy EnclaveTokenVaultV1C
    EnclaveTokenVault = await ethers.getContractFactory("EnclaveTokenVaultV1C");
    enclaveTokenVault = await EnclaveTokenVault.deploy(
      owner.address,
      mockGateway.target,
      routerRNSAddress,
      routerChainId
    );
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
  });

  describe("Solver Registration", function () {
    it("Should allow vault manager to register solver address", async function () {
      await enclaveTokenVault.registerSolverAddress(addr1.address);
      expect(await enclaveTokenVault.isRegisteredSolverAddress(addr1.address)).to.be.true;
    });

    it("Should revert when registering zero address", async function () {
      await expect(enclaveTokenVault.registerSolverAddress(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid address: zero address");
    });

    it("Should revert when non-manager tries to register", async function () {
      await expect(enclaveTokenVault.connect(addr1).registerSolverAddress(addr2.address))
        .to.be.revertedWith("Caller is not a vault manager");
    });
  });

  describe("Withdrawal Functions", function () {
    const depositAmount = ethers.parseEther("100");

    beforeEach(async function () {
      // Setup initial deposit
      await mockToken.mint(addr1.address, depositAmount);
      await mockToken.connect(addr1).approve(enclaveTokenVault.target, depositAmount);
      await enclaveTokenVault.connect(addr1).deposit(mockToken.target, depositAmount);
    });

    describe("withdrawSigned", function () {
      it("Should allow withdrawal with valid manager signature", async function () {
        // Get withdrawal hash and signature
        const hash = await enclaveTokenVault.getWithdrawalHash(
          mockToken.target,
          0, // WITHDRAW_SPECIFIC
          depositAmount,
          addr1.address
        );
        const signature = await owner.signMessage(ethers.getBytes(hash));

        // Perform withdrawal
        await enclaveTokenVault.connect(addr1).withdrawSigned(
          mockToken.target,
          depositAmount,
          signature
        );

        // Verify balances
        expect(await enclaveTokenVault.deposits(mockToken.target, addr1.address)).to.equal(0);
        expect(await mockToken.balanceOf(addr1.address)).to.equal(depositAmount);
      });

      it("Should revert with invalid signature", async function () {
        // Get withdrawal hash and sign with non-manager
        const hash = await enclaveTokenVault.getWithdrawalHash(
          mockToken.target,
          0,
          depositAmount,
          addr1.address
        );
        const signature = await addr2.signMessage(ethers.getBytes(hash));

        // Attempt withdrawal
        await expect(
          enclaveTokenVault.connect(addr1).withdrawSigned(
            mockToken.target,
            depositAmount,
            signature
          )
        ).to.be.revertedWith("Invalid Signature");
      });

      it("Should revert with modified amount in signature", async function () {
        // Sign for one amount but try to withdraw another
        const hash = await enclaveTokenVault.getWithdrawalHash(
          mockToken.target,
          0,
          depositAmount / 2n,
          addr1.address
        );
        const signature = await owner.signMessage(ethers.getBytes(hash));

        await expect(
          enclaveTokenVault.connect(addr1).withdrawSigned(
            mockToken.target,
            depositAmount,
            signature
          )
        ).to.be.revertedWith("Invalid Signature");
      });
    });

    describe("withdrawAll", function () {
      it("Should allow complete withdrawal with valid manager signature", async function () {
        // Get withdrawal hash and signature for withdrawAll (mode = 1)
        const hash = await enclaveTokenVault.getWithdrawalHash(
          mockToken.target,
          1, // WITHDRAW_ALL
          0, // amount is ignored for withdrawAll
          addr1.address
        );
        const signature = await owner.signMessage(ethers.getBytes(hash));

        const initialBalance = await mockToken.balanceOf(addr1.address);
        const depositBalance = await enclaveTokenVault.deposits(mockToken.target, addr1.address);

        // Perform withdrawAll
        await enclaveTokenVault.connect(addr1).withdrawAll(
          mockToken.target,
          signature
        );

        // Verify balances
        expect(await enclaveTokenVault.deposits(mockToken.target, addr1.address)).to.equal(0);
        expect(await mockToken.balanceOf(addr1.address)).to.equal(initialBalance + depositBalance);
      });

      it("Should revert withdrawAll with invalid signature", async function () {
        const hash = await enclaveTokenVault.getWithdrawalHash(
          mockToken.target,
          1,
          0,
          addr1.address
        );
        const signature = await addr2.signMessage(ethers.getBytes(hash));

        await expect(
          enclaveTokenVault.connect(addr1).withdrawAll(
            mockToken.target,
            signature
          )
        ).to.be.revertedWith("Invalid Signature");
      });

      it("Should revert withdrawAll when using withdraw-specific signature", async function () {
        // Get withdrawal hash for specific amount
        const hash = await enclaveTokenVault.getWithdrawalHash(
          mockToken.target,
          0, // WITHDRAW_SPECIFIC
          depositAmount,
          addr1.address
        );
        const signature = await owner.signMessage(ethers.getBytes(hash));

        await expect(
          enclaveTokenVault.connect(addr1).withdrawAll(
            mockToken.target,
            signature
          )
        ).to.be.revertedWith("Invalid Signature");
      });
    });
  });
});

