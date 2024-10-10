import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { EnclaveRegistry } from "../typechain-types";

describe("EnclaveRegistry", function () {
    let enclaveRegistry: EnclaveRegistry;
    let owner: Signer;
  let nonOwner: Signer;

  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();

    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    enclaveRegistry = await EnclaveRegistry.deploy();
    await enclaveRegistry.deployed();
  });

  describe("Deployment", function () {
    it("should set the right owner", async function () {
      expect(await enclaveRegistry.owner()).to.equal(await owner.getAddress());
    });
  });

  describe("updateRegistryAddress", function () {
    it("should allow owner to update registry address", async function () {
      const contractName = "TestContract";
      const contractAddress = ethers.Wallet.createRandom().address;

      await expect(enclaveRegistry.updateRegistryAddress(contractName, contractAddress))
        .to.emit(enclaveRegistry, "OwnershipTransferred")
        .withArgs(await owner.getAddress(), await owner.getAddress());

      expect(await enclaveRegistry.getRegistryAddress(contractName)).to.equal(contractAddress);
    });

    it("should not allow non-owner to update registry address", async function () {
      const contractName = "TestContract";
      const contractAddress = ethers.Wallet.createRandom().address;

      await expect(
        enclaveRegistry.connect(nonOwner).updateRegistryAddress(contractName, contractAddress)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when trying to set zero address", async function () {
      const contractName = "TestContract";
      const zeroAddress = ethers.ZeroAddress;

      await expect(
        enclaveRegistry.updateRegistryAddress(contractName, zeroAddress)
      ).to.be.revertedWith("Registry: Zero address");
    });
  });

  describe("getRegistryAddress", function () {
    it("should return the correct address for a registered contract", async function () {
      const contractName = "TestContract";
      const contractAddress = ethers.Wallet.createRandom().address;

      await enclaveRegistry.updateRegistryAddress(contractName, contractAddress);

      expect(await enclaveRegistry.getRegistryAddress(contractName)).to.equal(contractAddress);
    });

    it("should revert when trying to get an unregistered contract address", async function () {
      const unregisteredContractName = "UnregisteredContract";

      await expect(
        enclaveRegistry.getRegistryAddress(unregisteredContractName)
      ).to.be.revertedWith("Registry: Entry doesn't exist");
    });
  });
});