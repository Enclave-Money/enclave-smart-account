import { expect } from "chai";
import { ethers } from "hardhat";

describe("P256SmartAccountCreate3Factory", function () {
  let factory: any;
  let enclaveRegistry: any;
  let owner: any;
  let nonOwner: any;

  const MOCK_PUBKEY: [bigint, bigint] = [BigInt(1), BigInt(2)];
  const MOCK_SALT = ethers.keccak256(ethers.toUtf8Bytes("test-account"));

  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();

    // Deploy EnclaveRegistry (mock)
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistryV0");
    enclaveRegistry = await EnclaveRegistry.deploy(ownerAddress);

    // Mock required registry addresses
    await enclaveRegistry.updateRegistryAddress(
      ethers.keccak256(ethers.toUtf8Bytes("entryPoint")),
      ownerAddress
    );
    
    await enclaveRegistry.updateRegistryAddress(
      ethers.keccak256(ethers.toUtf8Bytes("moduleManager")),
      ownerAddress
    );

    // Deploy the factory
    const P256SmartAccountCreate3Factory = await ethers.getContractFactory("P256SmartAccountCreate3Factory");
    factory = await P256SmartAccountCreate3Factory.deploy();
  });

  describe("Deployment", function () {
    it("should deploy the account implementation", async function () {
      const implementationAddress = await factory.accountImplementation();
      expect(implementationAddress).to.be.properAddress;
      expect(implementationAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("createAccount", function () {
    it("should deploy a new account with the correct parameters", async function () {
      // First predict the address
      const predictedAddress = await factory.predictAccountAddress(MOCK_SALT);
      
      // Deploy the account
      const tx = await factory.createAccount(
        MOCK_PUBKEY,
        await enclaveRegistry.getAddress(),
        true, // smartBalanceEnabled
        MOCK_SALT
      );
      
      // Get the transaction receipt to verify the event
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (e: any) => e.fragment?.name === "AccountDeployed"
      );
      
      expect(event).to.not.be.undefined;
      expect(event.args.smartAccount).to.equal(predictedAddress);
      expect(event.args.salt).to.equal(MOCK_SALT);
      
      // Verify the account was created with the correct parameters
      const P256SmartAccountV1 = await ethers.getContractFactory("P256SmartAccountV1");
      const account: any = P256SmartAccountV1.attach(predictedAddress);
      
      expect(await account.pubKey(0)).to.equal(MOCK_PUBKEY[0]);
      expect(await account.pubKey(1)).to.equal(MOCK_PUBKEY[1]);
      expect(await account.enclaveRegistry()).to.equal(await enclaveRegistry.getAddress());
      expect(await account.smartBalanceEnabled()).to.equal(true);
    });

    it("should return the same address if deployed again with same salt", async function () {
      // Deploy the account first time
      const tx1 = await factory.createAccount(
        MOCK_PUBKEY,
        await enclaveRegistry.getAddress(),
        true,
        MOCK_SALT
      );
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find(
        (e: any) => e.fragment?.name === "AccountDeployed"
      );
      const firstAddress = event1.args.smartAccount;
      
      // Try to deploy again with same salt (should revert)
      await expect(
        factory.createAccount(
          MOCK_PUBKEY,
          await enclaveRegistry.getAddress(),
          false,
          MOCK_SALT
        )
      ).to.be.reverted;
      
      // The address should remain the same
      expect(await factory.predictAccountAddress(MOCK_SALT)).to.equal(firstAddress);
    });
  });

  describe("createMultipleAccounts", function () {
    it("should deploy multiple accounts in a single transaction", async function () {
      const registryAddress = await enclaveRegistry.getAddress();
      // Create test data for multiple accounts
      const pubKeys = [
        [BigInt(1), BigInt(2)],
        [BigInt(3), BigInt(4)],
        [BigInt(5), BigInt(6)]
      ];
      const registries = Array(3).fill(registryAddress);
      const smartBalanceFlags = [true, false, true];
      const salts = [
        ethers.keccak256(ethers.toUtf8Bytes("account1")),
        ethers.keccak256(ethers.toUtf8Bytes("account2")),
        ethers.keccak256(ethers.toUtf8Bytes("account3"))
      ];
      
      // Predict addresses before deployment
      const predictedAddresses = await Promise.all(
        salts.map(salt => factory.predictAccountAddress(salt))
      );
      
      // Deploy multiple accounts
      const tx = await factory.createMultipleAccounts(
        pubKeys,
        registries,
        smartBalanceFlags,
        salts
      );
      
      // Get the transaction receipt and verify events
      const receipt = await tx.wait();
      const events = receipt.logs.filter(
        (e: any) => e.fragment?.name === "AccountDeployed"
      );
      
      expect(events.length).to.equal(3);
      
      // Verify each account was created with the correct parameters
      const P256SmartAccountV1 = await ethers.getContractFactory("P256SmartAccountV1");
      
      for (let i = 0; i < 3; i++) {
        const accountAddress = events[i].args.smartAccount;
        expect(accountAddress).to.equal(predictedAddresses[i]);
        
        const account: any = P256SmartAccountV1.attach(accountAddress);
        expect(await account.pubKey(0)).to.equal(pubKeys[i][0]);
        expect(await account.pubKey(1)).to.equal(pubKeys[i][1]);
        expect(await account.enclaveRegistry()).to.equal(registryAddress);
        expect(await account.smartBalanceEnabled()).to.equal(smartBalanceFlags[i]);
      }
    });
    
    it("should revert if array lengths don't match", async function () {
      const registryAddress = await enclaveRegistry.getAddress();
      
      const pubKeys = [
        [BigInt(1), BigInt(2)],
        [BigInt(3), BigInt(4)]
      ];
      const registries = [registryAddress]; // Only one registry
      const smartBalanceFlags = [true, false];
      const salts = [
        ethers.keccak256(ethers.toUtf8Bytes("account1")),
        ethers.keccak256(ethers.toUtf8Bytes("account2"))
      ];
      
      // Should revert because registries array length doesn't match others
      await expect(
        factory.createMultipleAccounts(
          pubKeys,
          registries,
          smartBalanceFlags,
          salts
        )
      ).to.be.revertedWith("Length mismatch");
    });
  });

  describe("generateSalt", function () {
    it("should generate a unique salt for different names", async function () {
      const salt1 = await factory.generateSalt("account1");
      const salt2 = await factory.generateSalt("account2");
      
      expect(salt1).to.not.equal(salt2);
    });
    
    it("should generate the same salt for the same name", async function () {
      const salt1 = await factory.generateSalt("account1");
      const salt2 = await factory.generateSalt("account1");
      
      expect(salt1).to.equal(salt2);
    });
  });

  describe("predictAccountAddress", function () {
    it("should predict the address correctly", async function () {
      const salt = await factory.generateSalt("predictTest");
      const predictedAddress = await factory.predictAccountAddress(salt);
      
      // Deploy the account
      const tx = await factory.createAccount(
        MOCK_PUBKEY,
        await enclaveRegistry.getAddress(),
        true,
        salt
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (e: any) => e.fragment?.name === "AccountDeployed"
      );
      const actualAddress = event.args.smartAccount;
      
      expect(actualAddress).to.equal(predictedAddress);
    });
    
    it("should predict consistent addresses across different chains", async function () {
      // The CREATE3 pattern guarantees the same address on different chains
      // This is difficult to test without multiple chains, but we can check that
      // the address does not depend on contract state by modifying state and checking
      
      const salt = await factory.generateSalt("multichain");
      const predictedAddress = await factory.predictAccountAddress(salt);
      
      // Deploy a different account first to change the state
      await factory.createAccount(
        [BigInt(3), BigInt(4)],
        await enclaveRegistry.getAddress(),
        false,
        await factory.generateSalt("other-account")
      );
      
      // Check that the predicted address is still the same
      expect(await factory.predictAccountAddress(salt)).to.equal(predictedAddress);
    });
  });

  describe("Create3Proxy Upgradeability", function () {
    it("should allow the proxy to upgrade its implementation", async function () {
      // Deploy an account first
      const tx = await factory.createAccount(
        MOCK_PUBKEY,
        await enclaveRegistry.getAddress(),
        true,
        MOCK_SALT
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (e: any) => e.fragment?.name === "AccountDeployed"
      );
      const accountAddress = event.args.smartAccount;
      
      // Deploy a new implementation for testing
      const P256SmartAccountV1 = await ethers.getContractFactory("P256SmartAccountV1");
      const newImplementation = await P256SmartAccountV1.deploy();
      
      // Create the interface for the proxy contract
      const proxyInterface = new ethers.Interface([
        "function implementation() external view returns (address)",
        "function upgradeTo(address _implementation) public"
      ]);
      
      // Attach the interface to the proxy address
      const proxyContract = new ethers.Contract(accountAddress, proxyInterface, owner);
      
      // Get the original implementation address
      const originalImplementation = await proxyContract.implementation();
      
      // Create a call to the proxy from the account (since only the proxy itself can upgrade)
      const account: any = P256SmartAccountV1.attach(accountAddress);
      const callData = proxyInterface.encodeFunctionData("upgradeTo", [await newImplementation.getAddress()]);
      await account.connect(owner).execute(accountAddress, 0, callData);
      
      // Verify the implementation has changed
      const updatedImplementation = await proxyContract.implementation();
      expect(updatedImplementation).to.not.equal(originalImplementation);
      expect(updatedImplementation).to.equal(await newImplementation.getAddress());
    });
    
    it("should revert if a non-proxy tries to upgrade the implementation", async function () {
      // Deploy an account first
      const tx = await factory.createAccount(
        MOCK_PUBKEY,
        await enclaveRegistry.getAddress(),
        true,
        MOCK_SALT
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (e: any) => e.fragment?.name === "AccountDeployed"
      );
      const accountAddress = event.args.smartAccount;
      
      // Deploy a new implementation for testing
      const P256SmartAccountV1 = await ethers.getContractFactory("P256SmartAccountV1");
      const newImplementation = await P256SmartAccountV1.deploy();
      
      // Create the interface for the proxy contract
      const proxyInterface = new ethers.Interface([
        "function upgradeTo(address _implementation) public"
      ]);
      
      // Attach the interface to the proxy address
      const proxyContract = new ethers.Contract(accountAddress, proxyInterface, owner);
      
      // Try to upgrade directly (should revert)
      await expect(
        proxyContract.upgradeTo(await newImplementation.getAddress())
      ).to.be.reverted;
    });
  });
}); 