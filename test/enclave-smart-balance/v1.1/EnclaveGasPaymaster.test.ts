const { expect } = require("chai");
import { ethers } from "hardhat";
import { AbiCoder } from "ethers";

describe("EnclaveGasPaymaster", function () {
  let paymaster: any;
  let owner: any;
  let fundingAddress: any;
  let signingAddress: any;
  let user: any;
  let entryPoint: any;
  
  const orgId = ethers.id("test-organization");
  const abiCoder = new AbiCoder();

  beforeEach(async function () {
    [owner, fundingAddress, signingAddress, user] = await ethers.getSigners();

    // Deploy EntryPoint
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();

    // Deploy EnclaveGasPaymaster
    const PaymasterFactory = await ethers.getContractFactory("EnclaveGasPaymaster");
    paymaster = await PaymasterFactory.deploy(entryPoint);
    // await time.setNextBlockTimestamp(Math.floor(Date.now() / 1000));
  });

  describe("Organization Registration", function () {
    it("should register a new organization correctly", async function () {
      await expect(paymaster.connect(fundingAddress).registerOrganization(
        orgId,
        signingAddress.address
      ))
        .to.emit(paymaster, "OrganizationRegistered")
        .withArgs(orgId, signingAddress.address, fundingAddress.address);

      expect(await paymaster.registeredOrganizations(orgId)).to.be.true;
      expect(await paymaster.orgToSigningAddress(orgId)).to.equal(signingAddress.address);
      expect(await paymaster.orgToFundingAddress(orgId)).to.equal(fundingAddress.address);
    });

    it("should not allow registering same organization twice", async function () {
      await paymaster.connect(fundingAddress).registerOrganization(
        orgId,
        signingAddress.address
      );

      await expect(
        paymaster.connect(fundingAddress).registerOrganization(
          orgId,
          signingAddress.address
        )
      ).to.be.revertedWith("Organization ID already registered");
    });

    it("should not allow zero address as signing address", async function () {
      await expect(
        paymaster.connect(fundingAddress).registerOrganization(
          orgId,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid address");
    });

    it("should properly map addresses to organization", async function () {
      await paymaster.connect(fundingAddress).registerOrganization(
        orgId,
        signingAddress.address
      );

      expect(await paymaster.signingAddressToOrg(signingAddress.address)).to.equal(orgId);
      expect(await paymaster.fundingAddressToOrg(fundingAddress.address)).to.equal(orgId);
    });

    it("should not allow registering with funding address already in use", async function () {
      // Register first organization
      await paymaster.connect(fundingAddress).registerOrganization(
        orgId,
        signingAddress.address
      );

      const otherOrgId = ethers.id("other-organization");
      await expect(
        paymaster.connect(fundingAddress).registerOrganization(
          otherOrgId,
          signingAddress.address
        )
      ).to.be.revertedWith("Funding address already in use");
    });

    it("should not allow registering with signing address already in use", async function () {
      // Register first organization
      await paymaster.connect(fundingAddress).registerOrganization(
        orgId,
        signingAddress.address
      );

      const otherOrgId = ethers.id("other-organization");
      const otherFunder = user; // Using user as another funding address
      await expect(
        paymaster.connect(otherFunder).registerOrganization(
          otherOrgId,
          signingAddress.address
        )
      ).to.be.revertedWith("Signing address already in use");
    });
  });

  describe("Deposits and Withdrawals", function () {
    beforeEach(async function () {
      // Register organization first
      await paymaster.connect(fundingAddress).registerOrganization(
        orgId,
        signingAddress.address
      );
    });

    it("should accept deposits from funding address", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      await expect(
        paymaster.connect(fundingAddress).orgDeposit({ value: depositAmount })
      )
        .to.emit(paymaster, "OrganizationDeposit")
        .withArgs(orgId, depositAmount);

      expect(await paymaster.getOrgDeposit(orgId)).to.equal(depositAmount);
    });

    it("should allow withdrawals by funding address", async function () {
      const depositAmount = ethers.parseEther("1.0");
      const withdrawAmount = ethers.parseEther("0.5");
      
      await paymaster.connect(fundingAddress).orgDeposit({ value: depositAmount });
      
      await expect(
        paymaster.connect(fundingAddress).orgWithdraw(fundingAddress.address, withdrawAmount)
      )
        .to.emit(paymaster, "OrganizationWithdrawal")
        .withArgs(orgId, withdrawAmount);

      expect(await paymaster.getOrgDeposit(orgId)).to.equal(depositAmount - withdrawAmount);
    });

    it("should not allow withdrawals from non-funding address", async function () {
      const depositAmount = ethers.parseEther("1.0");
      const withdrawAmount = ethers.parseEther("0.5");
      
      await paymaster.connect(fundingAddress).orgDeposit({ value: depositAmount });
      
      await expect(
        paymaster.connect(user).orgWithdraw(user.address, withdrawAmount)
      ).to.be.revertedWith("Not a registered funding address");

      await expect(
        paymaster.connect(signingAddress).orgWithdraw(signingAddress.address, withdrawAmount)
      ).to.be.revertedWith("Not a registered funding address");

      // Balance should remain unchanged
      expect(await paymaster.getOrgDeposit(orgId)).to.equal(depositAmount);
    });

    it("should not accept deposits from non-funding address", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      await expect(
        paymaster.connect(user).orgDeposit({ value: depositAmount })
      ).to.be.revertedWith("Not a registered funding address");
    });

    it("should not allow withdrawals exceeding balance", async function () {
      const depositAmount = ethers.parseEther("1.0");
      const withdrawAmount = ethers.parseEther("1.5");
      
      await paymaster.connect(fundingAddress).orgDeposit({ value: depositAmount });
      
      await expect(
        paymaster.connect(fundingAddress).orgWithdraw(fundingAddress.address, withdrawAmount)
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("UserOperation Validation", function () {
    let userOp: any;
    let currentBlockTime: number;
    let validUntil: number;
    let validAfter: number;

    beforeEach(async function () {
      // Get current block timestamp
      currentBlockTime = (await ethers.provider.getBlock('latest'))?.timestamp || 0;
      validUntil = currentBlockTime + 3600; // 1 hour in the future
      validAfter = currentBlockTime;

      // Register organization
      await paymaster.connect(fundingAddress).registerOrganization(
        orgId,
        signingAddress.address
      );

      // Fund organization
      await paymaster.connect(fundingAddress).orgDeposit({ value: ethers.parseEther("1.0") });

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
      
      // Verify organization is properly registered
      expect(await paymaster.registeredOrganizations(orgId)).to.be.true;
      expect(await paymaster.orgToSigningAddress(orgId)).to.equal(signingAddress.address);
      expect(await paymaster.getOrgDeposit(orgId)).to.be.gt(0);

      // Impersonate EntryPoint
      await ethers.provider.send("hardhat_impersonateAccount", [entryPoint.target]);
      const entryPointSigner = await ethers.getSigner(entryPoint.target);
      
      // Fund EntryPoint with some ETH to pay for gas
      await owner.sendTransaction({
        to: entryPoint.target,
        value: ethers.parseEther("1.0")
      });

      // Connect paymaster contract to EntryPoint signer
      const paymasterAsEntryPoint = paymaster.connect(entryPointSigner);
      
      // Use callStatic to get the return values
      const validationResult = await paymasterAsEntryPoint.validatePaymasterUserOp.staticCall(
        userOp,
        ethers.ZeroHash,
        100000
      );

      console.log(validationResult);
      
      const [context, validationData] = validationResult;

      // Stop impersonating EntryPoint
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [entryPoint.target]);
      expect(context).to.equal(abiCoder.encode(["bytes32"], [orgId]));
    });

    it("should reject expired UserOperation", async function () {
      const expiredValidUntil = currentBlockTime - 3600; // 1 hour before current block
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
      
      // Verify organization is properly registered
      expect(await paymaster.registeredOrganizations(orgId)).to.be.true;
      expect(await paymaster.orgToSigningAddress(orgId)).to.equal(signingAddress.address);
      expect(await paymaster.getOrgDeposit(orgId)).to.be.gt(0);

      // Impersonate EntryPoint
      await ethers.provider.send("hardhat_impersonateAccount", [entryPoint.target]);
      const entryPointSigner = await ethers.getSigner(entryPoint.target);
      
      // Fund EntryPoint with some ETH to pay for gas
      await owner.sendTransaction({
        to: entryPoint.target,
        value: ethers.parseEther("1.0")
      });

      // Connect paymaster contract to EntryPoint signer
      const paymasterAsEntryPoint = paymaster.connect(entryPointSigner);
      
      // Use staticCall to get the return values
      const validationResult = await paymasterAsEntryPoint.validatePaymasterUserOp.staticCall(
        userOp,
        ethers.ZeroHash,
        100000
      );
      
      const [context, validationData] = validationResult;

      console.log("Context: ", context);

      // Stop impersonating EntryPoint
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [entryPoint.target]);

      // For expired operations, validationData should not be zero
      expect(validationData).to.not.equal(ethers.ZeroHash);
      expect(context).to.equal("0x");
    });

    it("should reject UserOperation signed by non-signing address", async function () {
      // Get hash for UserOperation
      const hash = await paymaster.getHash(userOp, validUntil, validAfter);
      // Sign with wrong address (using fundingAddress instead of signingAddress)
      const signature = await fundingAddress.signMessage(ethers.getBytes(hash));

      const paymasterAndData = ethers.concat([
        paymaster.target,
        abiCoder.encode(
          ["uint48", "uint48", "bytes32"],
          [validUntil, validAfter, orgId]
        ),
        signature
      ]);

      userOp.paymasterAndData = paymasterAndData;
      
      // Verify organization is properly registered
      expect(await paymaster.registeredOrganizations(orgId)).to.be.true;
      expect(await paymaster.orgToSigningAddress(orgId)).to.equal(signingAddress.address);
      expect(await paymaster.getOrgDeposit(orgId)).to.be.gt(0);

      // Impersonate EntryPoint
      await ethers.provider.send("hardhat_impersonateAccount", [entryPoint.target]);
      const entryPointSigner = await ethers.getSigner(entryPoint.target);
      
      // Fund EntryPoint with some ETH to pay for gas
      await owner.sendTransaction({
        to: entryPoint.target,
        value: ethers.parseEther("1.0")
      });

      // Connect paymaster contract to EntryPoint signer
      const paymasterAsEntryPoint = paymaster.connect(entryPointSigner);
      
      // Use staticCall to get the return values
      const validationResult = await paymasterAsEntryPoint.validatePaymasterUserOp.staticCall(
        userOp,
        ethers.ZeroHash,
        100000
      );
      
      const [context, validationData] = validationResult;

      // Stop impersonating EntryPoint
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [entryPoint.target]);

      // Validation should fail (validationData should not be zero)
      expect(validationData).to.not.equal(ethers.ZeroHash);
      // Context should be empty for failed validation
      expect(context).to.equal("0x");
    });
  });

  describe("Post-operation Processing", function () {
    it("should correctly process successful operation", async function () {
      // Register organization first
      await paymaster.connect(fundingAddress).registerOrganization(
        orgId,
        signingAddress.address
      );

      const depositAmount = ethers.parseEther("1.0");
      await paymaster.connect(fundingAddress).orgDeposit({ value: depositAmount });

      const actualGasCost = ethers.parseEther("0.1");
      const context = abiCoder.encode(["bytes32"], [orgId]);

      // Impersonate EntryPoint
      await ethers.provider.send("hardhat_impersonateAccount", [entryPoint.target]);
      const entryPointSigner = await ethers.getSigner(entryPoint.target);
      
      // Fund EntryPoint with some ETH to pay for gas
      await owner.sendTransaction({
        to: entryPoint.target,
        value: ethers.parseEther("1.0")
      });

      // Connect paymaster contract to EntryPoint signer
      const paymasterAsEntryPoint = paymaster.connect(entryPointSigner);

      await expect(paymasterAsEntryPoint.postOp(1, context, actualGasCost))
        .to.emit(paymaster, "TransactionSponsored")
        .withArgs(orgId, entryPoint.target, actualGasCost);

      // Stop impersonating EntryPoint
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [entryPoint.target]);

      expect(await paymaster.getOrgDeposit(orgId)).to.equal(depositAmount - actualGasCost);
    });
  });

  describe("Organization Address Updates", function () {
    beforeEach(async function () {
      // Register organization first
      await paymaster.connect(fundingAddress).registerOrganization(
        orgId,
        signingAddress.address
      );
    });

    describe("Funding Address Updates", function () {
      it("should allow previous funding address to update to new address", async function () {
        const newFundingAddress = user;
        
        await expect(paymaster.connect(fundingAddress).updateOrgFundingAddress(newFundingAddress.address))
          .to.emit(paymaster, "OrganizationFundingAddressUpdated")
          .withArgs(orgId, fundingAddress.address, newFundingAddress.address);

        expect(await paymaster.orgToFundingAddress(orgId)).to.equal(newFundingAddress.address);
        expect(await paymaster.fundingAddressToOrg(newFundingAddress.address)).to.equal(orgId);
        expect(await paymaster.fundingAddressToOrg(fundingAddress.address)).to.equal(ethers.ZeroHash);
      });

      it("should not allow non-previous funding address to update funding address", async function () {
        const newFundingAddress = user;
        
        await expect(
          paymaster.connect(owner).updateOrgFundingAddress(newFundingAddress.address)
        ).to.be.revertedWith("Sender not valid funding address");
      });

      it("should not allow update to zero address", async function () {
        await expect(
          paymaster.connect(fundingAddress).updateOrgFundingAddress(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid address");
      });

      it("should not allow update to an address already used by another organization", async function () {
        // Register another organization
        const otherOrgId = ethers.id("other-organization");
        const otherFunding = user;
        const otherSigning = owner;
        
        await paymaster.connect(otherFunding).registerOrganization(
          otherOrgId,
          otherSigning.address
        );

        // Try to update first org's funding address to second org's funding address
        await expect(
          paymaster.connect(fundingAddress).updateOrgFundingAddress(otherFunding.address)
        ).to.be.revertedWith("Funding address already registered");
      });
    });

    describe("Signing Address Updates", function () {
      it("should allow owner to update signing address", async function () {
        const newSigningAddress = user;
        
        await expect(paymaster.connect(owner).updateOrgSigningAddress(orgId, newSigningAddress.address))
          .to.emit(paymaster, "OrganizationSigningAddressUpdated")
          .withArgs(orgId, signingAddress.address, newSigningAddress.address);

        expect(await paymaster.orgToSigningAddress(orgId)).to.equal(newSigningAddress.address);
        expect(await paymaster.signingAddressToOrg(newSigningAddress.address)).to.equal(orgId);
        expect(await paymaster.signingAddressToOrg(signingAddress.address)).to.equal(ethers.ZeroHash);
      });

      it("should not allow non-owner to update signing address", async function () {
        const newSigningAddress = user;
        
        await expect(
          paymaster.connect(fundingAddress).updateOrgSigningAddress(orgId, newSigningAddress.address)
        ).to.be.revertedWith("Unauthorized");
      });

      it("should not allow update to zero address", async function () {
        await expect(
          paymaster.connect(owner).updateOrgSigningAddress(orgId, ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid address");
      });

      it("should not allow update to an address already used by another organization", async function () {
        // Register another organization
        const otherOrgId = ethers.id("other-organization");
        const otherFunding = user;
        const otherSigning = owner;
        
        await paymaster.connect(otherFunding).registerOrganization(
          otherOrgId,
          otherSigning.address
        );

        // Try to update first org's signing address to second org's signing address
        await expect(
          paymaster.connect(owner).updateOrgSigningAddress(orgId, otherSigning.address)
        ).to.be.revertedWith("Signing address already registered");
      });

      it("should not allow update for non-existent organization", async function () {
        const nonExistentOrgId = ethers.id("non-existent-org");
        await expect(
          paymaster.connect(owner).updateOrgSigningAddress(nonExistentOrgId, user.address)
        ).to.be.revertedWith("Organization not found");
      });
    });
  });
});
