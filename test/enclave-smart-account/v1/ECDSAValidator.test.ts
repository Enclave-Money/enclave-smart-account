import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ECDSAValidator, P256SmartAccountV1, EntryPoint } from "../../../typechain-types";
import { createUserOp } from "../../utils/userOp";

describe("ECDSAValidator", () => {
  let validator: ECDSAValidator;
  let smartAccount: P256SmartAccountV1;
  let entryPoint: EntryPoint;
  let owner: SignerWithAddress;
  let other: SignerWithAddress;
  
  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    
    // Deploy validator
    const ValidatorFactory = await ethers.getContractFactory("ECDSAValidator");
    validator = await ValidatorFactory.deploy();
    
    // Deploy and setup smart account (you'll need to add your deployment logic here)
    // ... setup code ...
    
    // Install validator on smart account
    await smartAccount.execute(
      validator.address,
      0,
      validator.interface.encodeFunctionData("onInstall", ["0x"])
    );
  });

  describe("Installation", () => {
    it("should initialize correctly", async () => {
      expect(await validator.isInitialized(smartAccount.address)).to.be.true;
    });

    it("should revert when installing twice", async () => {
      await expect(
        smartAccount.execute(
          validator.address,
          0,
          validator.interface.encodeFunctionData("onInstall", ["0x"])
        )
      ).to.be.revertedWithCustomError(validator, "AlreadyInitialized");
    });
  });

  describe("Uninstallation", () => {
    it("should uninstall correctly", async () => {
      await smartAccount.execute(
        validator.address,
        0,
        validator.interface.encodeFunctionData("onUninstall", ["0x"])
      );
      expect(await validator.isInitialized(smartAccount.address)).to.be.false;
    });

    it("should revert when uninstalling non-installed module", async () => {
      await smartAccount.execute(
        validator.address,
        0,
        validator.interface.encodeFunctionData("onUninstall", ["0x"])
      );
      
      await expect(
        smartAccount.execute(
          validator.address,
          0,
          validator.interface.encodeFunctionData("onUninstall", ["0x"])
        )
      ).to.be.revertedWithCustomError(validator, "NotInitialized");
    });
  });

  describe("validateUserOp", () => {
    it("should validate correct EOA signature", async () => {
      const userOp = await createUserOp({
        sender: smartAccount.address,
        nonce: 1,
        // Add other userOp parameters
      });
      
      const userOpHash = await entryPoint.getUserOpHash(userOp);
      const signature = await owner.signMessage(ethers.utils.arrayify(userOpHash));
      userOp.signature = signature;
      
      const validationResult = await validator.validateUserOp(userOp, userOpHash);
      expect(validationResult).to.equal(0);
    });

    it("should reject invalid signature", async () => {
      const userOp = await createUserOp({
        sender: smartAccount.address,
        nonce: 1,
        // Add other userOp parameters
      });
      
      const userOpHash = await entryPoint.getUserOpHash(userOp);
      const signature = await other.signMessage(ethers.utils.arrayify(userOpHash));
      userOp.signature = signature;
      
      const validationResult = await validator.validateUserOp(userOp, userOpHash);
      expect(validationResult).to.equal(1);
    });

    it("should revert if module is disabled", async () => {
      await smartAccount.execute(
        validator.address,
        0,
        validator.interface.encodeFunctionData("onUninstall", ["0x"])
      );

      const userOp = await createUserOp({
        sender: smartAccount.address,
        nonce: 1,
      });
      
      const userOpHash = await entryPoint.getUserOpHash(userOp);
      await expect(
        validator.validateUserOp(userOp, userOpHash)
      ).to.be.revertedWith("Module is disabled");
    });
  });

  describe("isValidSignatureWithSender", () => {
    it("should validate direct hash signature", async () => {
      const hash = ethers.utils.id("Hello World");
      const signature = await owner.signMessage(ethers.utils.arrayify(hash));
      
      const result = await validator.isValidSignatureWithSender(
        smartAccount.address,
        hash,
        signature
      );
      expect(result).to.equal("0x1626ba7e"); // ERC1271_MAGICVALUE
    });

    it("should validate EIP-191 signed message", async () => {
      const message = "Hello World";
      const hash = ethers.utils.id(message);
      const signature = await owner.signMessage(message);
      
      const result = await validator.isValidSignatureWithSender(
        smartAccount.address,
        hash,
        signature
      );
      expect(result).to.equal("0x1626ba7e"); // ERC1271_MAGICVALUE
    });

    it("should reject invalid signature", async () => {
      const hash = ethers.utils.id("Hello World");
      const signature = await other.signMessage(ethers.utils.arrayify(hash));
      
      const result = await validator.isValidSignatureWithSender(
        smartAccount.address,
        hash,
        signature
      );
      expect(result).to.equal("0xffffffff"); // ERC1271_INVALID
    });

    it("should revert if module is disabled", async () => {
      await smartAccount.execute(
        validator.address,
        0,
        validator.interface.encodeFunctionData("onUninstall", ["0x"])
      );

      const hash = ethers.utils.id("Hello World");
      const signature = await owner.signMessage(ethers.utils.arrayify(hash));
      
      await expect(
        validator.isValidSignatureWithSender(smartAccount.address, hash, signature)
      ).to.be.revertedWith("Module is disabled");
    });
  });
});
