const { expect } = require("chai");
import { ethers } from "hardhat";
import { AbiCoder } from "ethers";

describe("EnclaveGasPaymaster", function () {
  let paymaster: any;
  let owner: any;
  let verifyingSigner: any;
  let fundingAddress: any;
  let signingAddress: any;
  let user: any;
  let entryPoint: any;
  
  const orgId = ethers.id("test-organization");
  const abiCoder = new AbiCoder();

  beforeEach(async function () {
    [owner, verifyingSigner, fundingAddress, signingAddress, user] = await ethers.getSigners();

    // Deploy EntryPoint
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();

    // Deploy EnclaveGasPaymaster
    const PaymasterFactory = await ethers.getContractFactory("EnclaveGasPaymaster");
    paymaster = await PaymasterFactory.deploy(entryPoint, verifyingSigner.address);
  });

  describe("Organization Registration", function () {
    it("should register a new organization correctly", async function () {
      const nonce = await paymaster.fundingAddressNonces(fundingAddress.address);
      const messageHash = await paymaster.getRegistrationHash(
        orgId,
        fundingAddress.address,
        signingAddress.address
      );
      const signature = await fundingAddress.signMessage(ethers.getBytes(messageHash));

      await expect(paymaster.connect(owner).registerOrganization(
        abiCoder.encode(
          ["bytes32", "address", "address"],
          [orgId, fundingAddress.address, signingAddress.address]
        ),
        signature
      ))
        .to.emit(paymaster, "OrganizationRegistered")
        .withArgs(orgId, signingAddress.address, fundingAddress.address);

      expect(await paymaster.registeredOrganizations(orgId)).to.be.true;
      expect(await paymaster.orgToSigningAddress(orgId)).to.equal(signingAddress.address);
      expect(await paymaster.orgToFundingAddress(orgId)).to.equal(fundingAddress.address);
    });

    it("should prevent duplicate organization registration", async function () {
      // First registration
      const messageHash = await paymaster.getRegistrationHash(
        orgId,
        fundingAddress.address,
        signingAddress.address
      );
      const signature = await fundingAddress.signMessage(ethers.getBytes(messageHash));

      await paymaster.connect(owner).registerOrganization(
        abiCoder.encode(
          ["bytes32", "address", "address"],
          [orgId, fundingAddress.address, signingAddress.address]
        ),
        signature
      );

      // Attempt duplicate registration
      await expect(
        paymaster.connect(owner).registerOrganization(
          abiCoder.encode(
            ["bytes32", "address", "address"],
            [orgId, fundingAddress.address, signingAddress.address]
          ),
          signature
        )
      ).to.be.revertedWith("Organization already registered");
    });
  });

  describe("Deposits and Withdrawals", function () {
    beforeEach(async function () {
      // Register organization first
      const messageHash = await paymaster.getRegistrationHash(
        orgId,
        fundingAddress.address,
        signingAddress.address
      );
      const signature = await fundingAddress.signMessage(ethers.getBytes(messageHash));

      await paymaster.connect(owner).registerOrganization(
        abiCoder.encode(
          ["bytes32", "address", "address"],
          [orgId, fundingAddress.address, signingAddress.address]
        ),
        signature
      );
    });

    it("should accept deposits from funding address", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      await expect(
        paymaster.connect(fundingAddress).depositFor(orgId, { value: depositAmount })
      )
        .to.emit(paymaster, "OrganizationDeposit")
        .withArgs(orgId, depositAmount);

      expect(await paymaster.getOrgDeposit(orgId)).to.equal(depositAmount);
    });

    it("should allow withdrawals by funding address", async function () {
      const depositAmount = ethers.parseEther("1.0");
      const withdrawAmount = ethers.parseEther("0.5");
      
      await paymaster.connect(fundingAddress).depositFor(orgId, { value: depositAmount });
      
      await expect(
        paymaster.connect(fundingAddress).orgWithdraw(fundingAddress.address, withdrawAmount)
      )
        .to.emit(paymaster, "OrganizationWithdrawal")
        .withArgs(orgId, withdrawAmount);

      expect(await paymaster.getOrgDeposit(orgId)).to.equal(depositAmount - withdrawAmount);
    });
  });

  describe("UserOperation Validation", function () {
    let userOp: any;
    const validUntil = Math.floor(Date.now() / 1000) + 3600;
    const validAfter = Math.floor(Date.now() / 1000);

    beforeEach(async function () {
      // Register organization
      const messageHash = await paymaster.getRegistrationHash(
        orgId,
        fundingAddress.address,
        signingAddress.address
      );
      const signature = await fundingAddress.signMessage(ethers.getBytes(messageHash));

      await paymaster.connect(owner).registerOrganization(
        abiCoder.encode(
          ["bytes32", "address", "address"],
          [orgId, fundingAddress.address, signingAddress.address]
        ),
        signature
      );

      // Fund organization
      await paymaster.connect(fundingAddress).depositFor(orgId, { value: ethers.parseEther("1.0") });

      // Create UserOperation
      userOp = {
        sender: user.address,
        nonce: 0,
        initCode: "0x",
        callData: "0x",
        callGasLimit: 100000,
        verificationGasLimit: 100000,
        preVerificationGas: 50000,
        maxFeePerGas: ethers.parseUnits("10", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
        paymasterAndData: "0x",
        signature: "0x"
      };
    });

    it("should validate legitimate UserOperation", async function () {
      const hash = await paymaster.getHash(userOp, validUntil, validAfter);
      const signature = await signingAddress.signMessage(ethers.getBytes(hash));

      const paymasterAndData = ethers.concat([
        paymaster.target,
        abiCoder.encode(
          ["uint48", "uint48", "bytes32"],
          [validUntil, validAfter, orgId]
        ),
        signature
      ]);

      userOp.paymasterAndData = paymasterAndData;
      
      const [context, validationData] = await paymaster.validatePaymasterUserOp(
        userOp,
        ethers.ZeroHash,
        100000
      );

      expect(validationData).to.equal(ethers.ZeroHash);
    });

    it("should reject expired UserOperation", async function () {
      const expiredValidUntil = Math.floor(Date.now() / 1000) - 3600;
      const hash = await paymaster.getHash(userOp, expiredValidUntil, validAfter);
      const signature = await signingAddress.signMessage(ethers.getBytes(hash));

      const paymasterAndData = ethers.concat([
        paymaster.target,
        abiCoder.encode(
          ["uint48", "uint48", "bytes32"],
          [expiredValidUntil, validAfter, orgId]
        ),
        signature
      ]);

      userOp.paymasterAndData = paymasterAndData;
      
      const [context, validationData] = await paymaster.validatePaymasterUserOp(
        userOp,
        ethers.ZeroHash,
        100000
      );

      expect(validationData).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Post-operation Processing", function () {
    it("should correctly process successful operation", async function () {
      // Register and fund organization first
      const messageHash = await paymaster.getRegistrationHash(
        orgId,
        fundingAddress.address,
        signingAddress.address
      );
      const signature = await fundingAddress.signMessage(ethers.getBytes(messageHash));

      await paymaster.connect(owner).registerOrganization(
        abiCoder.encode(
          ["bytes32", "address", "address"],
          [orgId, fundingAddress.address, signingAddress.address]
        ),
        signature
      );

      const depositAmount = ethers.parseEther("1.0");
      await paymaster.connect(fundingAddress).depositFor(orgId, { value: depositAmount });

      const actualGasCost = ethers.parseEther("0.1");
      const context = abiCoder.encode(["bytes32"], [orgId]);

      await expect(paymaster._postOp(1, context, actualGasCost))
        .to.emit(paymaster, "TransactionSponsored")
        .withArgs(orgId, (await ethers.provider.getSigner()).address, actualGasCost);

      expect(await paymaster.getOrgDeposit(orgId)).to.equal(depositAmount - actualGasCost);
    });
  });
});
