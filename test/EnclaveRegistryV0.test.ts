import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EnclaveRegistryV0", function () {
  let enclaveRegistryV0: any;
  let owner: SignerWithAddress;
  let manager: SignerWithAddress;
  let nonManager: SignerWithAddress;
  let additionalSigners: SignerWithAddress[];

  beforeEach(async function () {
    const signers = await ethers.getSigners() as unknown as SignerWithAddress[];
    [owner, manager, nonManager, ...additionalSigners] = signers;

    const EnclaveRegistryV0Factory = await ethers.getContractFactory("EnclaveRegistryV0");
    enclaveRegistryV0 = await EnclaveRegistryV0Factory.deploy(owner.address);
    await enclaveRegistryV0.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the deployer as a manager", async function () {
      expect(await enclaveRegistryV0.isManager(owner.address)).to.be.true;
    });

    it("should not set any other address as a manager by default", async function () {
      expect(await enclaveRegistryV0.isManager(manager.address)).to.be.false;
      expect(await enclaveRegistryV0.isManager(nonManager.address)).to.be.false;
    });

    it("should accept a different address as the initial manager", async function () {
      const EnclaveRegistryV0Factory = await ethers.getContractFactory("EnclaveRegistryV0");
      const registry = await EnclaveRegistryV0Factory.deploy(manager.address);
      await registry.waitForDeployment();
      
      expect(await registry.isManager(manager.address)).to.be.true;
      expect(await registry.isManager(owner.address)).to.be.false;
    });

    it("should revert if zero address is passed as owner", async function () {
      const EnclaveRegistryV0Factory = await ethers.getContractFactory("EnclaveRegistryV0");
      await expect(
        EnclaveRegistryV0Factory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(EnclaveRegistryV0Factory, "ZeroAddress");
    });
  });

  describe("Manager management", function () {
    it("should allow a manager to add another manager", async function () {
      await enclaveRegistryV0.addManager(manager.address);
      expect(await enclaveRegistryV0.isManager(manager.address)).to.be.true;
    });

    it("should not allow a non-manager to add a manager", async function () {
      await expect(
        enclaveRegistryV0.connect(nonManager).addManager(manager.address)
      ).to.be.revertedWithCustomError(enclaveRegistryV0, "CallerNotManager");
    });

    it("should not allow adding a zero address as manager", async function () {
      await expect(
        enclaveRegistryV0.addManager(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(enclaveRegistryV0, "ZeroAddress");
    });

    it("should not allow adding an existing manager again", async function () {
      await enclaveRegistryV0.addManager(manager.address);
      await expect(
        enclaveRegistryV0.addManager(manager.address)
      ).to.be.revertedWithCustomError(enclaveRegistryV0, "AlreadyManager");
    });

    it("should allow a manager to remove another manager", async function () {
      await enclaveRegistryV0.addManager(manager.address);
      expect(await enclaveRegistryV0.isManager(manager.address)).to.be.true;
      
      await enclaveRegistryV0.removeManager(manager.address);
      expect(await enclaveRegistryV0.isManager(manager.address)).to.be.false;
    });

    it("should allow a manager to remove themselves when not the last manager", async function () {
      await enclaveRegistryV0.addManager(manager.address);
      
      // Manager removes themselves
      await enclaveRegistryV0.connect(manager).removeManager(manager.address);
      expect(await enclaveRegistryV0.isManager(manager.address)).to.be.false;
    });

    it("should not allow removing the last manager", async function () {
      // Try to remove the owner (only manager) as the owner
      await expect(
        enclaveRegistryV0.removeManager(owner.address)
      ).to.be.revertedWithCustomError(enclaveRegistryV0, "CannotRemoveLastManager");
    });

    it("should not allow a non-manager to remove a manager", async function () {
      await enclaveRegistryV0.addManager(manager.address);
      
      await expect(
        enclaveRegistryV0.connect(nonManager).removeManager(manager.address)
      ).to.be.revertedWithCustomError(enclaveRegistryV0, "CallerNotManager");
    });

    it("should not allow removing a non-manager address", async function () {
      await expect(
        enclaveRegistryV0.removeManager(nonManager.address)
      ).to.be.revertedWithCustomError(enclaveRegistryV0, "NotManager");
    });

    it("should correctly track manager count through multiple operations", async function () {
      // Start with 1 manager (owner)
      
      // Add two more managers
      await enclaveRegistryV0.addManager(manager.address);
      await enclaveRegistryV0.addManager(nonManager.address);
      
      // Remove one manager
      await enclaveRegistryV0.removeManager(manager.address);
      
      // First manager should still be able to be removed
      await enclaveRegistryV0.removeManager(nonManager.address);
      
      // But now we can't remove the owner as they're the last manager
      await expect(
        enclaveRegistryV0.removeManager(owner.address)
      ).to.be.revertedWithCustomError(enclaveRegistryV0, "CannotRemoveLastManager");
    });

    it("should support adding multiple managers sequentially", async function () {
      // Make sure we have at least 5 additional signers
      expect(additionalSigners.length).to.be.at.least(5);
      
      // Add multiple managers
      for (let i = 0; i < 5; i++) {
        await enclaveRegistryV0.addManager(additionalSigners[i].address);
        expect(await enclaveRegistryV0.isManager(additionalSigners[i].address)).to.be.true;
      }
      
      // Each new manager should be able to add more managers
      await enclaveRegistryV0.connect(additionalSigners[0]).addManager(manager.address);
      expect(await enclaveRegistryV0.isManager(manager.address)).to.be.true;
      
      // Each manager should be able to remove other managers
      await enclaveRegistryV0.connect(additionalSigners[1]).removeManager(additionalSigners[0].address);
      expect(await enclaveRegistryV0.isManager(additionalSigners[0].address)).to.be.false;
    });

    it("should allow removing all but one manager", async function () {
      // Add multiple managers
      for (let i = 0; i < 5; i++) {
        await enclaveRegistryV0.addManager(additionalSigners[i].address);
      }
      
      // Remove all except owner
      for (let i = 0; i < 5; i++) {
        await enclaveRegistryV0.removeManager(additionalSigners[i].address);
        expect(await enclaveRegistryV0.isManager(additionalSigners[i].address)).to.be.false;
      }
      
      // Owner should still be a manager
      expect(await enclaveRegistryV0.isManager(owner.address)).to.be.true;
      
      // Cannot remove the last manager
      await expect(
        enclaveRegistryV0.removeManager(owner.address)
      ).to.be.revertedWithCustomError(enclaveRegistryV0, "CannotRemoveLastManager");
    });
  });

  describe("Registry management", function () {
    it("should allow a manager to update registry address", async function () {
      const contractName = ethers.encodeBytes32String("TestContract");
      const contractAddress = nonManager.address;

      await enclaveRegistryV0.updateRegistryAddress(contractName, contractAddress);
      expect(await enclaveRegistryV0.getRegistryAddress(contractName)).to.equal(contractAddress);
    });

    it("should allow a manager to update an existing registry address", async function () {
      const contractName = ethers.encodeBytes32String("TestContract");
      const firstAddress = nonManager.address;
      const secondAddress = manager.address;

      await enclaveRegistryV0.updateRegistryAddress(contractName, firstAddress);
      expect(await enclaveRegistryV0.getRegistryAddress(contractName)).to.equal(firstAddress);

      await enclaveRegistryV0.updateRegistryAddress(contractName, secondAddress);
      expect(await enclaveRegistryV0.getRegistryAddress(contractName)).to.equal(secondAddress);
    });

    it("should not allow a non-manager to update registry address", async function () {
      const contractName = ethers.encodeBytes32String("TestContract");
      const contractAddress = manager.address;

      await expect(
        enclaveRegistryV0.connect(nonManager).updateRegistryAddress(contractName, contractAddress)
      ).to.be.revertedWithCustomError(enclaveRegistryV0, "CallerNotManager");
    });

    it("should return zero address for unregistered contract names", async function () {
      const unregisteredName = ethers.encodeBytes32String("Unregistered");
      expect(await enclaveRegistryV0.getRegistryAddress(unregisteredName)).to.equal(ethers.ZeroAddress);
    });

    it("should allow setting address to zero (for removal)", async function () {
      const contractName = ethers.encodeBytes32String("TestContract");
      const contractAddress = nonManager.address;

      // First register it
      await enclaveRegistryV0.updateRegistryAddress(contractName, contractAddress);
      expect(await enclaveRegistryV0.getRegistryAddress(contractName)).to.equal(contractAddress);

      // Then remove it by setting to zero address
      await enclaveRegistryV0.updateRegistryAddress(contractName, ethers.ZeroAddress);
      expect(await enclaveRegistryV0.getRegistryAddress(contractName)).to.equal(ethers.ZeroAddress);
    });

    it("should handle different types of bytes32 names", async function () {
      // Test with different formats of bytes32 strings
      const names = [
        ethers.encodeBytes32String(""), // Empty string
        ethers.encodeBytes32String("Short"), 
        ethers.encodeBytes32String("LongContractName"), // Shorter but still reasonable name
        "0x0000000000000000000000000000000000000000000000000000000000000001", // Raw bytes
        ethers.keccak256(ethers.toUtf8Bytes("DynamicName")) // Hash of a string
      ];
      
      // Register all with different addresses
      for (let i = 0; i < names.length; i++) {
        const addressToRegister = i === 0 ? 
          ethers.ZeroAddress : // Use zero address for empty string
          additionalSigners[i-1].address; // Use different addresses for others
          
        await enclaveRegistryV0.updateRegistryAddress(names[i], addressToRegister);
      }
      
      // Verify all registrations
      for (let i = 0; i < names.length; i++) {
        const expectedAddress = i === 0 ? 
          ethers.ZeroAddress : 
          additionalSigners[i-1].address;
          
        expect(await enclaveRegistryV0.getRegistryAddress(names[i])).to.equal(expectedAddress);
      }
    });
  });

  describe("Edge cases", function () {
    it("should handle multiple registry entries correctly", async function () {
      const names = [
        ethers.encodeBytes32String("Contract1"),
        ethers.encodeBytes32String("Contract2"),
        ethers.encodeBytes32String("Contract3")
      ];
      
      const addresses = [
        owner.address,
        manager.address,
        nonManager.address
      ];

      // Register all contracts
      for (let i = 0; i < names.length; i++) {
        await enclaveRegistryV0.updateRegistryAddress(names[i], addresses[i]);
      }

      // Verify all registrations
      for (let i = 0; i < names.length; i++) {
        expect(await enclaveRegistryV0.getRegistryAddress(names[i])).to.equal(addresses[i]);
      }
    });

    it("should maintain correct manager status after multiple operations", async function () {
      // Add a new manager
      await enclaveRegistryV0.addManager(manager.address);
      expect(await enclaveRegistryV0.isManager(manager.address)).to.be.true;
      
      // New manager adds another manager
      await enclaveRegistryV0.connect(manager).addManager(nonManager.address);
      expect(await enclaveRegistryV0.isManager(nonManager.address)).to.be.true;
      
      // Second manager removes the first manager
      await enclaveRegistryV0.connect(nonManager).removeManager(manager.address);
      expect(await enclaveRegistryV0.isManager(manager.address)).to.be.false;
      
      // Original manager removes the second manager
      await enclaveRegistryV0.removeManager(nonManager.address);
      expect(await enclaveRegistryV0.isManager(nonManager.address)).to.be.false;
      
      // Verify only the original owner is still a manager
      expect(await enclaveRegistryV0.isManager(owner.address)).to.be.true;
      expect(await enclaveRegistryV0.isManager(manager.address)).to.be.false;
      expect(await enclaveRegistryV0.isManager(nonManager.address)).to.be.false;
    });

    it("should still allow registry operations after manager changes", async function () {
      // Add a new manager
      await enclaveRegistryV0.addManager(manager.address);
      
      // Register a contract as the original manager
      const contractName1 = ethers.encodeBytes32String("Contract1");
      await enclaveRegistryV0.updateRegistryAddress(contractName1, nonManager.address);
      
      // Register a contract as the new manager
      const contractName2 = ethers.encodeBytes32String("Contract2");
      await enclaveRegistryV0.connect(manager).updateRegistryAddress(contractName2, owner.address);
      
      // Remove the new manager
      await enclaveRegistryV0.removeManager(manager.address);
      
      // Verify the registry entries remain intact
      expect(await enclaveRegistryV0.getRegistryAddress(contractName1)).to.equal(nonManager.address);
      expect(await enclaveRegistryV0.getRegistryAddress(contractName2)).to.equal(owner.address);
      
      // Original manager can still update registry
      await enclaveRegistryV0.updateRegistryAddress(contractName1, manager.address);
      expect(await enclaveRegistryV0.getRegistryAddress(contractName1)).to.equal(manager.address);
      
      // Removed manager can no longer update registry
      await expect(
        enclaveRegistryV0.connect(manager).updateRegistryAddress(contractName2, nonManager.address)
      ).to.be.revertedWithCustomError(enclaveRegistryV0, "CallerNotManager");
    });
  });

  describe("Gas usage and limits", function() {
    it("should handle large numbers of registry entries efficiently", async function() {
      // Add a large number of registry entries (10 for testing, could be more in a real gas test)
      for (let i = 0; i < 10; i++) {
        const name = ethers.encodeBytes32String(`Contract${i}`);
        await enclaveRegistryV0.updateRegistryAddress(name, additionalSigners[i % additionalSigners.length].address);
      }
      
      // Verify a few random entries
      expect(await enclaveRegistryV0.getRegistryAddress(ethers.encodeBytes32String("Contract3"))).to.equal(
        additionalSigners[3 % additionalSigners.length].address
      );
      
      expect(await enclaveRegistryV0.getRegistryAddress(ethers.encodeBytes32String("Contract7"))).to.equal(
        additionalSigners[7 % additionalSigners.length].address
      );
    });
  });

  describe("Events", function() {
    it("should emit ManagerAdded event when adding a manager", async function() {
      await expect(enclaveRegistryV0.addManager(manager.address))
        .to.emit(enclaveRegistryV0, "ManagerAdded")
        .withArgs(manager.address);
    });

    it("should emit ManagerRemoved event when removing a manager", async function() {
      await enclaveRegistryV0.addManager(manager.address);
      await expect(enclaveRegistryV0.removeManager(manager.address))
        .to.emit(enclaveRegistryV0, "ManagerRemoved")
        .withArgs(manager.address);
    });

    it("should emit RegistryUpdated event when updating registry", async function() {
      const contractName = ethers.encodeBytes32String("TestContract");
      await expect(enclaveRegistryV0.updateRegistryAddress(contractName, manager.address))
        .to.emit(enclaveRegistryV0, "RegistryUpdated")
        .withArgs(contractName, manager.address);
    });
  });
}); 