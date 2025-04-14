import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

interface UserOperation {
  sender: string;
  nonce: number;
  initCode: string;
  callData: string;
  callGasLimit: number;
  verificationGasLimit: number;
  preVerificationGas: number;
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
  paymasterAndData: string;
  signature: string;
}

const DefaultsForUserOp: UserOperation = {
  sender: ethers.ZeroAddress,
  nonce: 0,
  initCode: "0x",
  callData: "0x",
  callGasLimit: 0,
  verificationGasLimit: 1000000,
  preVerificationGas: 1000000,
  maxFeePerGas: 2001126985,
  maxPriorityFeePerGas: 1e9,
  paymasterAndData: "0x",
  signature: "0x",
};

describe("P256SmartAccountV1", function () {
  let account: Contract;
  let registry: Contract;
  let owner: Signer;
  let guardian: Signer;
  let other: Signer;
  let entryPoint: Contract;
  let moduleManager: Contract;
  let mockValidator: Contract;
  let mockVault: Contract;

  const mockPubKey = [
    ethers.toBigInt("1234567890"),
    ethers.toBigInt("9876543210")
  ];

  beforeEach(async function () {
    [owner, guardian, other] = await ethers.getSigners();

    // Deploy mock contracts
    const Registry = await ethers.getContractFactory("EnclaveRegistry");
    registry = await Registry.deploy(owner) as unknown as Contract;
    await registry.waitForDeployment();

    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy() as unknown as Contract;

    const ModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
    moduleManager = await ModuleManager.deploy(registry.target) as unknown as Contract;
    await moduleManager.waitForDeployment();

    const MockValidator = await ethers.getContractFactory("MockValidatorP256");
    mockValidator = await MockValidator.deploy(registry.target) as unknown as Contract;
    await mockValidator.waitForDeployment();

    const MockVault = await ethers.getContractFactory("MockVault");
    mockVault = await MockVault.deploy() as unknown as Contract;
    await mockVault.waitForDeployment();

    // Register addresses
    await registry.updateRegistryAddress("entryPoint", entryPoint.target);
    await registry.updateRegistryAddress("moduleManager", moduleManager.target);
    await registry.updateRegistryAddress("smartBalanceVault", mockVault.target);
    await registry.updateRegistryAddress("smartBalanceConversionManager", mockValidator.target);
    await registry.updateRegistryAddress("moduleManagerEoa", await owner.getAddress());

    // Enable mock validator in module manager
    await moduleManager.enableModule(mockValidator.target);

    // Deploy account
    const AccountFactory = await ethers.getContractFactory("P256SmartAccountFactoryV1");
    const accountFactory = await AccountFactory.deploy() as unknown as Contract;
    await accountFactory.waitForDeployment();

    const accountAddress = await accountFactory.getAccountAddress(mockPubKey, registry.target, true, 0);
    const tx = await accountFactory.createAccount(mockPubKey, registry.target, true, 0);
    await tx.wait();

    const Account = await ethers.getContractFactory("P256SmartAccountV1");
    account = Account.attach(accountAddress) as Contract;

    const transferAmount = ethers.parseEther("1.0");
    const tx2 = await owner.sendTransaction({
      to: account.target,
      value: transferAmount
    });
    await tx2.wait();
  });

  describe("Initialization", function () {
    it("Should set correct initial values", async function () {
      expect(await account.pubKey(0)).to.equal(mockPubKey[0]);
      expect(await account.pubKey(1)).to.equal(mockPubKey[1]);
      expect(await account.enclaveRegistry()).to.equal(registry.target);
      expect(await account.smartBalanceEnabled()).to.be.true;
    });

    it("Should not allow reinitialization", async function () {
      await expect(
        account.initialize(mockPubKey, registry.target, false)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("Smart Balance", function () {
    it("Should allow owner to enable/disable smart balance", async function () {
      const setSmartBalanceCall = account.interface.encodeFunctionData("setSmartBalanceEnabled", [true]);
      
      const userOp: UserOperation = { ...DefaultsForUserOp };
      userOp.sender = account.target as string;
      userOp.callData = account.interface.encodeFunctionData("execute", [
        account.target,
        0,
        setSmartBalanceCall
      ]);
      userOp.signature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [mockValidator.target, "0x"]
      );

      await entryPoint.handleOps([userOp], await owner.getAddress());
      expect(await account.smartBalanceEnabled()).to.be.true;
    });

    it("Should allow smart balance conversion for native token", async function () {

      // Then try to convert
      const convertCall = account.interface.encodeFunctionData("smartBalanceConvert", [
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
      ]);
      
      const convertUserOp: UserOperation = { ...DefaultsForUserOp };
      convertUserOp.sender = account.target as string;
      convertUserOp.callData = account.interface.encodeFunctionData("execute", [
        account.target,
        0,
        convertCall
      ]);
      convertUserOp.signature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [mockValidator.target, "0x"]
      );

      await expect(entryPoint.handleOps([convertUserOp], await owner.getAddress())).to.not.be.reverted;
    });
  });

  describe("Signature Validation", function () {
    it("Should validate signatures through enabled modules", async function () {
      const userOp: UserOperation = { ...DefaultsForUserOp };
      userOp.sender = account.target as string;
      userOp.callData = "0x";
      userOp.signature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [mockValidator.target, "0x1234"]
      );

      // Set up the mock validator to return success
      await mockValidator.setValidationResult(0);

      // Successful validation should revert with ValidationResult
      await expect(
        entryPoint.simulateValidation(userOp, { gasLimit: 1000000 })
      ).to.be.revertedWithCustomError(entryPoint, "ValidationResult");
    });

    it("Should fail validation for disabled modules", async function () {
      await moduleManager.disableModule(mockValidator.target);

      const userOp: UserOperation = { ...DefaultsForUserOp };
      userOp.sender = account.target as string;
      userOp.callData = "0x";
      userOp.signature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [mockValidator.target, "0x1234"]
      );

      await mockValidator.setValidationResult(0);

      // The validation should fail with "Module validation failed"
      await expect(
        entryPoint.simulateValidation(userOp, { gasLimit: 1000000 })
      ).to.be.reverted;
    });
  });

  describe("ERC1271 Signature Validation", function () {
    it("Should validate signatures through enabled modules", async function () {
      const hash = ethers.keccak256("0x1234");
      const signature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [mockValidator.target, "0x1234"]
      );

      const magicValue = await account.isValidSignature(hash, signature);
      expect(magicValue).to.equal("0x1626ba7e");
    });

    it("Should fail validation for disabled modules", async function () {
      await moduleManager.disableModule(mockValidator.target);

      const hash = ethers.keccak256("0x1234");
      const signature = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [mockValidator.target, "0x1234"]
      );

      const magicValue = await account.isValidSignature(hash, signature);
      expect(magicValue).to.equal("0xffffffff");
    });
  });
});
