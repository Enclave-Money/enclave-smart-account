import { expect } from "chai";
import { ethers } from "hardhat";
import { EnclaveFeeLogicUniswap, EnclaveRegistry, EnclaveVerifyingTokenPaymaster, P256SmartAccount, P256SmartAccountFactory, P256Verifier } from "../typechain-types";
import { BigNumberish, Signer } from "ethers";

describe("P256SmartAccount", function () {
  let p256SmartAccount: P256SmartAccount;
  let p256Verifier: P256Verifier;
  let owner: Signer;
  let guardian1: Signer;
  let guardian2: Signer;
  let nonGuardian: Signer;
  let feelogic: EnclaveFeeLogicUniswap;
  let enclaveVerifyingTokenPaymaster: EnclaveVerifyingTokenPaymaster;
  let enclaveP256SmartAccountFactory: P256SmartAccountFactory;
  let enclaveRegistry: EnclaveRegistry;

  const MOCK_P256_PUBLIC_KEY: [BigNumberish, BigNumberish] = [BigInt(1), BigInt(2)]; // Replace with valid P256 public key coordinates
  const MOCK_SIGNATURE = "0x..."; // Replace with a valid signature format

  beforeEach(async function () {
    [owner, guardian1, guardian2, nonGuardian] = await ethers.getSigners();

    const P256Verifier = await ethers.getContractFactory("P256Verifier");
    p256Verifier = await P256Verifier.deploy();

    const P256SmartAccount = await ethers.getContractFactory("P256SmartAccount");
    p256SmartAccount = await P256SmartAccount.deploy();

    // Deploy Feelogic contract
    const Feelogic = await ethers.getContractFactory("EnclaveFeeLogicUniswap");
    feelogic = await Feelogic.deploy(ethers.ZeroAddress, ethers.ZeroAddress, 0);

    // Deploy EnclaveVerifyingTokenPaymaster
    const EnclaveVerifyingTokenPaymaster = await ethers.getContractFactory("EnclaveVerifyingTokenPaymaster");
    enclaveVerifyingTokenPaymaster = await EnclaveVerifyingTokenPaymaster.deploy(
      ethers.ZeroAddress, // entryPoint
      ethers.ZeroAddress, // verifyingSigner
      ethers.ZeroAddress, // token
      ethers.ZeroAddress, // token
    );

    // Deploy EnclaveP256SmartAccountFactory
    const EnclaveP256SmartAccountFactory = await ethers.getContractFactory("P256SmartAccountFactory");
    enclaveP256SmartAccountFactory = await EnclaveP256SmartAccountFactory.deploy();

    // Deploy EnclaveRegistry
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    enclaveRegistry = await EnclaveRegistry.deploy();

    // Set up EnclaveRegistry
    await enclaveRegistry.updateRegistryAddress("feeLogic", await feelogic.getAddress());
    await enclaveRegistry.updateRegistryAddress("paymaster", await enclaveVerifyingTokenPaymaster.getAddress());
    await enclaveRegistry.updateRegistryAddress("p256SmartAccountFactory", await enclaveP256SmartAccountFactory.getAddress());

    await p256SmartAccount.initialize(MOCK_P256_PUBLIC_KEY, await enclaveRegistry.getAddress());
  });

  describe("Guardian Management", function () {
    it("should allow owner to add a guardian", async function () {
      await expect(p256SmartAccount.addGuardian(await guardian1.getAddress()))
        .to.emit(p256SmartAccount, "GuardianAdded")
        .withArgs(await guardian1.getAddress());
    });
    it("should not allow non-owner to add a guardian", async function () {
      await expect(p256SmartAccount.connect(nonGuardian).addGuardian(await guardian1.getAddress()))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow owner to remove a guardian", async function () {
      await p256SmartAccount.addGuardian(await guardian1.getAddress());
      await expect(p256SmartAccount.removeGuardian(await guardian1.getAddress()))
        .to.emit(p256SmartAccount, "GuardianRemoved")
        .withArgs(await guardian1.getAddress());

      expect(await p256SmartAccount.isGuardian(await guardian1.getAddress())).to.be.false;
    });

    it("should not allow non-owner to remove a guardian", async function () {
      await p256SmartAccount.addGuardian(await guardian1.getAddress());
      await expect(p256SmartAccount.connect(nonGuardian).removeGuardian(await guardian1.getAddress()))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should return correct guardian count", async function () {
      expect(await p256SmartAccount.getGuardianCount()).to.equal(0);

      await p256SmartAccount.addGuardian(await guardian1.getAddress());
      expect(await p256SmartAccount.getGuardianCount()).to.equal(1);

      await p256SmartAccount.addGuardian(await guardian2.getAddress());
      expect(await p256SmartAccount.getGuardianCount()).to.equal(2);

      await p256SmartAccount.removeGuardian(await guardian1.getAddress());
      expect(await p256SmartAccount.getGuardianCount()).to.equal(1);
    });
    it("should not allow adding the same guardian twice", async function () {
      await p256SmartAccount.addGuardian(await guardian1.getAddress());
      await expect(p256SmartAccount.addGuardian(await guardian1.getAddress()))
        .to.be.revertedWith("Guardian already exists");
    });
    it("should not allow removing a non-existent guardian", async function () {
      await expect(p256SmartAccount.removeGuardian(await guardian1.getAddress()))
        .to.be.revertedWith("Guardian does not exist");
    });
  });

  describe("isValidSignature (EIP-1271)", function () {
    const testMessage = "Hello, World!";
    const testMessageHash = ethers.id(testMessage);

    it("should return magic value for valid owner signature", async function () {
      const signature = await createMockValidSignature(testMessageHash, owner);
      const result = await p256SmartAccount.isValidSignature(testMessageHash, signature);
      expect(result).to.equal("0x1626ba7e");
    });

    it("should return failure value for invalid signature", async function () {
      const invalidSignature = "0x1234567890";
      const result = await p256SmartAccount.isValidSignature(testMessageHash, invalidSignature);
      expect(result).to.equal("0xffffffff");
    });
    it("should return magic value for valid guardian signature", async function () {
      await p256SmartAccount.addGuardian(await guardian1.getAddress());
      const signature = await createMockValidSignature(testMessageHash, guardian1);
      const result = await p256SmartAccount.isValidSignature(testMessageHash, signature);
      expect(result).to.equal("0x1626ba7e");
    });

    it("should return failure value for non-guardian signature", async function () {
      const signature = await createMockValidSignature(testMessageHash, nonGuardian);
      const result = await p256SmartAccount.isValidSignature(testMessageHash, signature);
      expect(result).to.equal("0xffffffff");
    });

    it("should handle different message types", async function () {
      const byteMessage = ethers.arrayify("0x1234567890");
      const byteMessageHash = ethers.keccak256(byteMessage);
      const signature = await createMockValidSignature(byteMessageHash, owner);
      const result = await p256SmartAccount.isValidSignature(byteMessageHash, signature);
      expect(result).to.equal("0x1626ba7e");
    });
  });
});

// Helper function to create a mock valid signature
// In a real scenario, this would use the actual P256 signing process
async function createMockValidSignature(hash: string, signer: Signer): Promise<string> {
  const signature = await signer.signMessage(ethers.utils.arrayify(hash));
  // Convert the signature to the format expected by your contract
  // This is a placeholder and should be adjusted based on your actual implementation
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "uint256", "bytes", "string", "string"],
    [1, 2, "0x", "prefix", "suffix"]
  );
}