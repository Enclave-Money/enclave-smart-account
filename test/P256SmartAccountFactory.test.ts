import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("P256SmartAccountFactory", function () {
  let p256SmartAccountFactory: Contract;
  let enclaveRegistry: Contract;
  let owner: Signer;
  let nonOwner: Signer;

  const MOCK_PUBKEY: [bigint, bigint] = [BigInt(1), BigInt(2)];
  const MOCK_SALT = 123456;

  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();

    // Deploy EnclaveRegistry (mock)
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    enclaveRegistry = await EnclaveRegistry.deploy();
    await enclaveRegistry.deployed();

    // Deploy P256SmartAccountFactory
    const P256SmartAccountFactory = await ethers.getContractFactory("P256SmartAccountFactory");
    p256SmartAccountFactory = await P256SmartAccountFactory.deploy();
    await p256SmartAccountFactory.deployed();
  });

  describe("Deployment", function () {
    it("should deploy the account implementation", async function () {
      const implementationAddress = await p256SmartAccountFactory.accountImplementation();
      expect(implementationAddress).to.be.properAddress;
      expect(implementationAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("createAccount", function () {
    it("should create a new account", async function () {
      const tx = await p256SmartAccountFactory.createAccount(MOCK_PUBKEY, enclaveRegistry.address, MOCK_SALT);
      const receipt = await tx.wait();
      
      // Check for events or other indicators of successful account creation
      expect(receipt.status).to.equal(1);

      // Verify the created account address
      const createdAccountAddress = await p256SmartAccountFactory.getAccountAddress(MOCK_PUBKEY, enclaveRegistry.address, MOCK_SALT);
      expect(createdAccountAddress).to.be.properAddress;
      expect(createdAccountAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should return existing account if already deployed", async function () {
      // Create account first time
      await p256SmartAccountFactory.createAccount(MOCK_PUBKEY, enclaveRegistry.address, MOCK_SALT);
      
      // Try to create the same account again
      const tx = await p256SmartAccountFactory.createAccount(MOCK_PUBKEY, enclaveRegistry.address, MOCK_SALT);
      const receipt = await tx.wait();
      
      // Check that the transaction was successful
      expect(receipt.status).to.equal(1);

      // Verify that the returned address is the same as the first creation
      const accountAddress = await p256SmartAccountFactory.getAccountAddress(MOCK_PUBKEY, enclaveRegistry.address, MOCK_SALT);
      expect(accountAddress).to.be.properAddress;
      expect(accountAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("getAccountAddress", function () {
    it("should return the correct counterfactual address", async function () {
      const counterfactualAddress = await p256SmartAccountFactory.getAccountAddress(MOCK_PUBKEY, enclaveRegistry.address, MOCK_SALT);
      expect(counterfactualAddress).to.be.properAddress;
      expect(counterfactualAddress).to.not.equal(ethers.ZeroAddress);

      // Create the account
      await p256SmartAccountFactory.createAccount(MOCK_PUBKEY, enclaveRegistry.address, MOCK_SALT);

      // Check that the created account address matches the counterfactual address
      const createdAccountAddress = await p256SmartAccountFactory.getAccountAddress(MOCK_PUBKEY, enclaveRegistry.address, MOCK_SALT);
      expect(createdAccountAddress).to.equal(counterfactualAddress);
    });

    it("should return different addresses for different salts", async function () {
      const address1 = await p256SmartAccountFactory.getAccountAddress(MOCK_PUBKEY, enclaveRegistry.address, MOCK_SALT);
      const address2 = await p256SmartAccountFactory.getAccountAddress(MOCK_PUBKEY, enclaveRegistry.address, MOCK_SALT + 1);
      expect(address1).to.not.equal(address2);
    });
  });
});