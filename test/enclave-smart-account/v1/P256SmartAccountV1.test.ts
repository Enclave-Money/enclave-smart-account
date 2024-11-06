import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, EventLog, Signer } from "ethers";

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
  verificationGasLimit: 1000000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 1000000, // should also cover calldata cost.
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
  let p256Validator: Contract;
  let ecdsaValidator: Contract;
  let multichainEcdsaValidator: Contract;
  let multichainP256Validator: Contract;
  let sessionKeyValidator: Contract;

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
    console.log("Registry deployed to: ", registry.target);

    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy() as unknown as Contract;

    const P256Verifier = await ethers.getContractFactory("P256Verifier");
    const verifier = await P256Verifier.deploy();
    await verifier.waitForDeployment();
    console.log("P256Verifier deployed to:", verifier.target);

    // Deploy P256V with verifier address
    const P256V = await ethers.getContractFactory("P256V");
    const p256v = await P256V.deploy(verifier.target);
    await p256v.waitForDeployment();
    console.log("P256V deployed to:", p256v.target);
    
    const ECDSA = await ethers.getContractFactory("MockValidatorECDSA");
    ecdsaValidator = await ECDSA.deploy() as unknown as Contract;
    await ecdsaValidator.waitForDeployment();
    console.log("ECDSA Val: ", ecdsaValidator.target);

    const P256 = await ethers.getContractFactory("MockValidatorP256");
    p256Validator = await P256.deploy(registry.target) as unknown as Contract;
    await p256Validator.waitForDeployment();
    console.log("P256 Val: ", p256Validator.target);
    
    const MultiECDSA = await ethers.getContractFactory("MockValidatorECDSA");
    multichainEcdsaValidator = await MultiECDSA.deploy() as unknown as Contract;
    await multichainEcdsaValidator.waitForDeployment();
    console.log("MultiECDSA Val: ", multichainEcdsaValidator.target);
    
    const MultiP256 = await ethers.getContractFactory("MockValidatorP256");
    multichainP256Validator = await MultiP256.deploy(registry.target) as unknown as Contract;
    await multichainP256Validator.waitForDeployment();
    console.log("MultiP256 Val: ", multichainP256Validator.target);

    // Register addresses
    await registry.updateRegistryAddress("entryPoint", entryPoint.target);
    await registry.updateRegistryAddress("p256Verifier", p256v.target);
    await registry.updateRegistryAddress("P256Validator", p256Validator.target);
    await registry.updateRegistryAddress("ECDSAValidator", ecdsaValidator.target);
    await registry.updateRegistryAddress("MultichainECDSAValidator", multichainEcdsaValidator.target);
    await registry.updateRegistryAddress("MultichainP256Validator", multichainP256Validator.target);

    console.log("Updated registry");

    // Deploy account
    const AccountFactory = await ethers.getContractFactory("P256SmartAccountFactoryV1");
    const accountFactory = await AccountFactory.deploy() as unknown as Contract;
    await accountFactory.waitForDeployment();
    console.log("Account factory deployed at: ", accountFactory.target);

    const accountAddress = await accountFactory.getAccountAddress(mockPubKey, registry.target, 0);
    console.log("Pre-determined contract address: ", accountAddress);

    const tx = await accountFactory.createAccount(mockPubKey, registry.target, 0);
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
      expect(await account.eoaOwner()).to.equal(ethers.ZeroAddress);
    });

    it("Should not allow reinitialization", async function () {
      await expect(
        account.initialize(mockPubKey, registry.target)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("EOA Owner Management", function () {
    it("Should allow setting EOA owner through execute", async function () {
      const setOwnerCall = account.interface.encodeFunctionData("setEoaOwner", [await owner.getAddress()]);
      
      // Create UserOperation
      const userOp: UserOperation = { ...DefaultsForUserOp };
      userOp.sender = account.target as string;
      userOp.callData = account.interface.encodeFunctionData("execute", [
        account.target,
        0,
        setOwnerCall
      ]);
      userOp.signature = "0x"; // You might need to add proper signature based on your validation logic

      // Execute through EntryPoint
      const tx = await entryPoint.handleOps([userOp], await owner.getAddress());
      const receipt = await tx.wait();
      console.log("Receipt: ", receipt);

      const events = await entryPoint.queryFilter(entryPoint.filters.UserOperationEvent(), receipt.blockNumber);
      console.log("Events: ", events.length);
      console.log("UserOperationEvent:", events[0]);
      
      if ('event' in events[0] && events[0].event === "UserOperationEvent") {
        const event = events[0] as EventLog;
        if (!event.args[4]) { // success is at index 4
          const revertReasonEvents = await entryPoint.queryFilter(entryPoint.filters.UserOperationRevertReason(), receipt.blockNumber);
          if (revertReasonEvents.length > 0) {
            const revertEvent = revertReasonEvents[0] as EventLog;
            console.log("Revert reason:", revertEvent.args[0]); // assuming revert reason is first argument
          }
        }
      }
      
      
      expect(await account.eoaOwner()).to.equal(await owner.getAddress());
    });

    it("Should not allow direct EOA owner setting", async function () {
      await expect(
        account.setEoaOwner(await owner.getAddress())
      ).to.be.revertedWith("Only callable by self");
    });

    it("Should allow disabling EOA owner through execute", async function () {
      const setOwnerCall = account.interface.encodeFunctionData("setEoaOwner", [await owner.getAddress()]);
      
      // Create UserOperation
      const userOp: UserOperation = { ...DefaultsForUserOp };
      userOp.sender = account.target as string;
      userOp.callData = account.interface.encodeFunctionData("execute", [
        account.target,
        0,
        setOwnerCall
      ]);
      userOp.signature = "0x"; // You might need to add proper signature based on your validation logic

      // Execute through EntryPoint
      await entryPoint.handleOps([userOp], await owner.getAddress());
      
      const disableCall = account.interface.encodeFunctionData("disableEoaOwner", []);
      
      // Create UserOperation
      const disableUserOp: UserOperation = { ...DefaultsForUserOp };
      disableUserOp.sender = account.target as string;
      disableUserOp.callData = account.interface.encodeFunctionData("execute", [
        account.target,
        0,
        disableCall
      ]);
      disableUserOp.signature = "0x"; // You might need to add proper signature based on your validation logic

      // Execute through EntryPoint
      await entryPoint.handleOps([disableUserOp], await owner.getAddress());
      
      expect(await account.eoaOwner()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Signature Validation", function () {
    let userOp: UserOperation;

    beforeEach(async function () {
      userOp = {
        sender: account.target as string,
        nonce: 0,
        initCode: "0x",
        callData: "0x",
        callGasLimit: 0,
        verificationGasLimit: 0,
        preVerificationGas: 0,
        maxFeePerGas: 0,
        maxPriorityFeePerGas: 0,
        paymasterAndData: "0x",
        signature: "0x"
      };
    });

    it("Should validate P256 signatures (mode 0)", async function () {
      userOp.nonce = 0;
      const hash = ethers.keccak256("0x1234");
      const mockSig = "0x1234";
      
      await expect(
        account.validateUserOp(userOp, hash, { gasLimit: 1000000 })
      ).to.not.be.reverted;
    });

    it("Should validate ECDSA signatures (mode 1)", async function () {
      userOp.nonce = 1;
      const setOwnerCall = account.interface.encodeFunctionData("setEoaOwner", [await owner.getAddress()]);
      await account.execute(account.address, 0, setOwnerCall);
      
      const hash = ethers.keccak256("0x1234");
      const mockSig = "0x1234";
      
      await expect(
        account.validateUserOp(userOp, hash, { gasLimit: 1000000 })
      ).to.not.be.reverted;
    });

    it("Should fail ECDSA validation if EOA owner not set", async function () {
      userOp.nonce = 1;
      const hash = ethers.keccak256("0x1234");
      
      await expect(
        account.validateUserOp(userOp, hash, { gasLimit: 1000000 })
      ).to.be.revertedWith("EOA Not enabled");
    });

    it("Should validate multichain ECDSA signatures (mode 2)", async function () {
      userOp.nonce = 2;
      const hash = ethers.keccak256("0x1234");
      
      await expect(
        account.validateUserOp(userOp, hash, { gasLimit: 1000000 })
      ).to.not.be.reverted;
    });

    it("Should validate multichain P256 signatures (mode 3)", async function () {
      userOp.nonce = 3;
      const hash = ethers.keccak256("0x1234");
      
      await expect(
        account.validateUserOp(userOp, hash, { gasLimit: 1000000 })
      ).to.not.be.reverted;
    });

    it("Should validate session key signatures (mode 4)", async function () {
      userOp.nonce = 4;
      const hash = ethers.keccak256("0x1234");
      
      await expect(
        account.validateUserOp(userOp, hash, { gasLimit: 1000000 })
      ).to.not.be.reverted;
    });

    it("Should fail for invalid validation mode", async function () {
      userOp.nonce = 5; // Invalid mode
      const hash = ethers.keccak256("0x1234");
      
      const validationData = await account.validateUserOp(userOp, hash, { gasLimit: 1000000 });
      expect(validationData.toString()).to.equal("1"); // SIG_VALIDATION_FAILED
    });
  });
});
