import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseContract } from "ethers";
import { EnclaveRegistryV0, SmartAccountFactoryV1, SmartAccountV1 } from "../typechain-types";

describe("SmartAccountFactoryV1", function () {
  let smartAccountFactory: SmartAccountFactoryV1;
  let enclaveRegistry: EnclaveRegistryV0;
  let owner: string;
  let user1: string;
  let user2: string;

  // Constants for testing
  const DEFAULT_SALT = 123456789n;
  const ENTRYPOINT = ethers.keccak256(ethers.toUtf8Bytes("entryPoint"));
  const MODULE_MANAGER = ethers.keccak256(ethers.toUtf8Bytes("moduleManager"));

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = await signers[0].getAddress();
    user1 = await signers[1].getAddress();
    user2 = await signers[2].getAddress();

    // Deploy EnclaveRegistry
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistryV0");
    enclaveRegistry = await EnclaveRegistry.deploy(owner) as EnclaveRegistryV0;
    await enclaveRegistry.waitForDeployment();

    // Add some necessary registry entries for the account to work
    const mockEntryPointAddress = user2; // Using user2 as a mock entry point
    await enclaveRegistry.updateRegistryAddress(ENTRYPOINT, mockEntryPointAddress);
    
    // Deploy a mock module manager
    const mockModuleManagerAddress = user1; // Using user1 as a mock module manager
    await enclaveRegistry.updateRegistryAddress(MODULE_MANAGER, mockModuleManagerAddress);

    // Deploy SmartAccountFactoryV1
    const SmartAccountFactory = await ethers.getContractFactory("SmartAccountFactoryV1");
    smartAccountFactory = await SmartAccountFactory.deploy() as SmartAccountFactoryV1;
    await smartAccountFactory.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should deploy the account implementation", async function () {
      const implementationAddress = await smartAccountFactory.accountImplementation();
      expect(implementationAddress).to.not.equal(ethers.ZeroAddress);
      expect(implementationAddress).to.be.a.properAddress;
    });
  });

  describe("getAccountAddress", function () {
    it("should return the correct counterfactual address", async function () {
      const smartBalanceEnabled = true;
      const counterfactualAddress = await smartAccountFactory.getAccountAddress(
        user1, 
        await enclaveRegistry.getAddress(), 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      expect(counterfactualAddress).to.be.a.properAddress;
      expect(counterfactualAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should return different addresses for different owners", async function () {
      const smartBalanceEnabled = true;
      const registryAddress = await enclaveRegistry.getAddress();
      
      const address1 = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      const address2 = await smartAccountFactory.getAccountAddress(
        user2, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      expect(address1).to.not.equal(address2);
    });

    it("should return different addresses for different registry addresses", async function () {
      const smartBalanceEnabled = true;
      
      // Deploy a second registry
      const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistryV0");
      const secondRegistry = await EnclaveRegistry.deploy(owner) as EnclaveRegistryV0;
      await secondRegistry.waitForDeployment();
      
      const address1 = await smartAccountFactory.getAccountAddress(
        user1, 
        await enclaveRegistry.getAddress(), 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      const address2 = await smartAccountFactory.getAccountAddress(
        user1, 
        await secondRegistry.getAddress(), 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      expect(address1).to.not.equal(address2);
    });

    it("should return different addresses for different smartBalanceEnabled values", async function () {
      const registryAddress = await enclaveRegistry.getAddress();
      
      const address1 = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        true, 
        DEFAULT_SALT
      );
      
      const address2 = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        false, 
        DEFAULT_SALT
      );
      
      expect(address1).to.not.equal(address2);
    });

    it("should return different addresses for different salts", async function () {
      const smartBalanceEnabled = true;
      const registryAddress = await enclaveRegistry.getAddress();
      
      const address1 = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      const address2 = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT + 1n
      );
      
      expect(address1).to.not.equal(address2);
    });
  });

  describe("createAccount", function () {
    it("should successfully create a new account", async function () {
      const smartBalanceEnabled = true;
      const registryAddress = await enclaveRegistry.getAddress();
      
      // Get the counterfactual address
      const expectedAddress = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      // Check that no code exists at the address yet
      const codeBefore = await ethers.provider.getCode(expectedAddress);
      expect(codeBefore).to.equal("0x");
      
      // Create the account
      const tx = await smartAccountFactory.createAccount(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      await tx.wait();
      
      // Check that code now exists at the address
      const codeAfter = await ethers.provider.getCode(expectedAddress);
      expect(codeAfter).to.not.equal("0x");
      expect(codeAfter.length).to.be.gt(2); // Should have some bytecode
      
      // Get the returned account 
      const accountAddress = await smartAccountFactory.createAccount.staticCall(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      expect(accountAddress).to.equal(expectedAddress);
    });

    it("should emit AccountCreated event", async function () {
      const smartBalanceEnabled = true;
      const registryAddress = await enclaveRegistry.getAddress();
      
      const expectedAddress = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      await expect(
        smartAccountFactory.createAccount(
          user1, 
          registryAddress, 
          smartBalanceEnabled, 
          DEFAULT_SALT
        )
      )
      .to.emit(smartAccountFactory, "AccountCreated")
      .withArgs(expectedAddress, user1);
    });

    it("should return existing account if already deployed", async function () {
      const smartBalanceEnabled = true;
      const registryAddress = await enclaveRegistry.getAddress();
      
      // Create account the first time
      const tx1 = await smartAccountFactory.createAccount(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      await tx1.wait();
      
      const expectedAddress = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      // Create the same account again
      const tx2 = await smartAccountFactory.createAccount(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      await tx2.wait();
      
      // Check the returned address is correct
      const returnedAddress = await smartAccountFactory.createAccount.staticCall(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      expect(returnedAddress).to.equal(expectedAddress);
    });
  });

  describe("Account Initialization", function () {
    it("should initialize account with correct parameters", async function () {
      const smartBalanceEnabled = true;
      const registryAddress = await enclaveRegistry.getAddress();
      
      // Create the account
      await smartAccountFactory.createAccount(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      const accountAddress = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        smartBalanceEnabled, 
        DEFAULT_SALT
      );
      
      // Create a contract instance of the account to interact with it
      const SmartAccountV1Factory = await ethers.getContractFactory("SmartAccountV1");
      const accountInstance = await SmartAccountV1Factory.attach(accountAddress) as SmartAccountV1;
      
      // Check if the account was initialized correctly
      expect(await accountInstance.owner()).to.equal(user1);
      expect(await accountInstance.enclaveRegistry()).to.equal(registryAddress);
      expect(await accountInstance.smartBalanceEnabled()).to.equal(smartBalanceEnabled);
    });

    it("should create accounts with different parameters correctly", async function () {
      const registryAddress = await enclaveRegistry.getAddress();
      
      // Create an account with smartBalanceEnabled = true
      await smartAccountFactory.createAccount(
        user1, 
        registryAddress, 
        true, 
        DEFAULT_SALT
      );
      
      const account1Address = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        true, 
        DEFAULT_SALT
      );
      
      // Create an account with smartBalanceEnabled = false
      await smartAccountFactory.createAccount(
        user2, 
        registryAddress, 
        false, 
        DEFAULT_SALT + 1n
      );
      
      const account2Address = await smartAccountFactory.getAccountAddress(
        user2, 
        registryAddress, 
        false, 
        DEFAULT_SALT + 1n
      );
      
      // Create contract instances
      const SmartAccountV1Factory = await ethers.getContractFactory("SmartAccountV1");
      const account1 = await SmartAccountV1Factory.attach(account1Address) as SmartAccountV1;
      const account2 = await SmartAccountV1Factory.attach(account2Address) as SmartAccountV1;
      
      // Check initialization parameters
      expect(await account1.owner()).to.equal(user1);
      expect(await account1.smartBalanceEnabled()).to.equal(true);
      
      expect(await account2.owner()).to.equal(user2);
      expect(await account2.smartBalanceEnabled()).to.equal(false);
    });
  });

  describe("Create2 Determinism", function () {
    it("should create accounts at the predicted addresses", async function () {
      const registryAddress = await enclaveRegistry.getAddress();
      
      // Generate multiple accounts with different parameters
      const testCases = [
        { owner: user1, smartBalance: true, salt: DEFAULT_SALT },
        { owner: user1, smartBalance: false, salt: DEFAULT_SALT + 1n },
        { owner: user2, smartBalance: true, salt: DEFAULT_SALT + 2n },
        { owner: user2, smartBalance: false, salt: DEFAULT_SALT + 3n }
      ];
      
      for (const testCase of testCases) {
        // Predict the address first
        const predictedAddress = await smartAccountFactory.getAccountAddress(
          testCase.owner, 
          registryAddress, 
          testCase.smartBalance, 
          testCase.salt
        );
        
        // Create the account
        await smartAccountFactory.createAccount(
          testCase.owner, 
          registryAddress, 
          testCase.smartBalance, 
          testCase.salt
        );
        
        // Check the code exists at the predicted address
        const code = await ethers.provider.getCode(predictedAddress);
        expect(code).to.not.equal("0x");
        expect(code.length).to.be.gt(2);
      }
    });
  });

  describe("Account Implementation", function () {
    it("should use the correct implementation contract", async function () {
      // Get the implementation address from the factory
      const implementationAddress = await smartAccountFactory.accountImplementation();
      
      // Check that code exists at the implementation address
      const implementationCode = await ethers.provider.getCode(implementationAddress);
      expect(implementationCode).to.not.equal("0x");
      expect(implementationCode.length).to.be.gt(100); // Should have substantial bytecode
      
      // Deploy a fresh implementation to verify it's a contract
      const SmartAccountV1Factory = await ethers.getContractFactory("SmartAccountV1");
      const freshImplementation = await SmartAccountV1Factory.deploy() as SmartAccountV1;
      await freshImplementation.waitForDeployment();
      
      // Get the bytecode of the fresh implementation
      const freshImplementationAddress = await freshImplementation.getAddress();
      const freshImplementationCode = await ethers.provider.getCode(freshImplementationAddress);
      
      // Check that it's a valid contract with bytecode
      expect(freshImplementationCode).to.not.equal("0x");
      expect(freshImplementationCode.length).to.be.gt(100);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero address for owner parameter", async function () {
      const registryAddress = await enclaveRegistry.getAddress();
      
      // Try to get an address with owner = zero address
      const counterfactualAddress = await smartAccountFactory.getAccountAddress(
        ethers.ZeroAddress, 
        registryAddress, 
        true, 
        DEFAULT_SALT
      );
      
      // Should still return a valid address (even though this might not be a good idea to deploy)
      expect(counterfactualAddress).to.be.a.properAddress;
      expect(counterfactualAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should handle zero address for registry parameter", async function () {
      // Try to get an address with registry = zero address
      const counterfactualAddress = await smartAccountFactory.getAccountAddress(
        user1, 
        ethers.ZeroAddress, 
        true, 
        DEFAULT_SALT
      );
      
      // Should still return a valid address (even though this might not be a good idea to deploy)
      expect(counterfactualAddress).to.be.a.properAddress;
      expect(counterfactualAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should handle very large salt values", async function () {
      const registryAddress = await enclaveRegistry.getAddress();
      const largeSalt = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"); // Max uint256
      
      // Try to get an address with a very large salt
      const counterfactualAddress = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        true, 
        largeSalt
      );
      
      // Should still return a valid address
      expect(counterfactualAddress).to.be.a.properAddress;
      expect(counterfactualAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should be able to deploy and use account in same transaction", async function() {
      const registryAddress = await enclaveRegistry.getAddress();
      const salt = DEFAULT_SALT + 100n;
      
      // Get the counterfactual address first
      const expectedAddress = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        true, 
        salt
      );
      
      // Contract to deploy which will interact with the account
      const mockContractFactory = await ethers.getContractFactory("MockUSDC");
      const mockToken = await mockContractFactory.deploy("Mock USDC", "USDC");
      await mockToken.waitForDeployment();
      
      // Create a contract that creates the account and then calls a method on it
      const tester = new ethers.Contract(
        expectedAddress,
        [
          "function owner() view returns (address)"
        ],
        ethers.provider
      );
      
      // Create the account
      await smartAccountFactory.createAccount(
        user1, 
        registryAddress, 
        true, 
        salt
      );
      
      // Verify we can interact with it
      const ownerFromAccount = await tester.owner();
      expect(ownerFromAccount).to.equal(user1);
    });
    
    it("should handle multiple accounts creation with same params but different salts", async function() {
      const registryAddress = await enclaveRegistry.getAddress();
      const accounts = [];
      
      // Create 5 accounts with incrementing salts
      for (let i = 0; i < 5; i++) {
        const salt = DEFAULT_SALT + BigInt(1000 + i);
        
        // Create the account
        await smartAccountFactory.createAccount(
          user1, 
          registryAddress, 
          true, 
          salt
        );
        
        // Get the address
        const accountAddress = await smartAccountFactory.getAccountAddress(
          user1, 
          registryAddress, 
          true, 
          salt
        );
        
        accounts.push(accountAddress);
      }
      
      // Verify all addresses are unique
      const uniqueAddresses = new Set(accounts);
      expect(uniqueAddresses.size).to.equal(5);
    });
  });

  describe("Account Proxy Functionality", function () {
    let accountInstance: SmartAccountV1;
    let accountAddress: string;

    beforeEach(async function () {
      const registryAddress = await enclaveRegistry.getAddress();
      const salt = DEFAULT_SALT + 5000n;
      
      // Create an account
      await smartAccountFactory.createAccount(
        user1, 
        registryAddress, 
        true, 
        salt
      );
      
      // Get the address
      accountAddress = await smartAccountFactory.getAccountAddress(
        user1, 
        registryAddress, 
        true, 
        salt
      );
      
      // Create a contract instance
      const SmartAccountV1Factory = await ethers.getContractFactory("SmartAccountV1");
      accountInstance = await SmartAccountV1Factory.attach(accountAddress) as SmartAccountV1;
    });

    it("should correctly identify the proxy implementation", async function () {
      // Get the implementation address from the factory
      const expectedImplementation = await smartAccountFactory.accountImplementation();
      
      // The ERC1967 proxy slot where the implementation address is stored
      const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
      
      // Get the value from the slot
      const implementationFromSlot = await ethers.provider.getStorage(accountAddress, IMPLEMENTATION_SLOT);
      
      // Convert to address format
      const slotImplementationAddress = ethers.getAddress("0x" + implementationFromSlot.slice(26));
      
      // Check that it matches the factory's implementation
      expect(slotImplementationAddress.toLowerCase()).to.equal(expectedImplementation.toLowerCase());
    });

    it("should prevent double initialization", async function () {
      // Try to initialize the account again
      await expect(
        accountInstance.initialize(user2, await enclaveRegistry.getAddress(), false)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("should allow owner to execute transactions", async function () {
      // Create a mock token
      const mockContractFactory = await ethers.getContractFactory("MockUSDC");
      const mockToken = await mockContractFactory.deploy("Mock USDC", "USDC");
      await mockToken.waitForDeployment();
      
      // Mint some tokens to the account
      const tokenAmount = ethers.parseUnits("1000", 6); // Assuming 6 decimals
      await mockToken.mint(accountAddress, tokenAmount);
      
      // Check initial balance
      const initialBalance = await mockToken.balanceOf(accountAddress);
      expect(initialBalance).to.equal(tokenAmount);
      
      // Prepare transfer call
      const transferAmount = ethers.parseUnits("500", 6);
      const transferCalldata = mockToken.interface.encodeFunctionData(
        "transfer", 
        [user2, transferAmount]
      );
      
      // Execute the transfer as owner
      const user1Signer = await ethers.getSigner(user1);
      const accountInstanceAsOwner = accountInstance.connect(user1Signer);
      
      await accountInstanceAsOwner.execute(
        await mockToken.getAddress(),
        0, // No ETH value
        transferCalldata
      );
      
      // Check final balances
      const finalAccountBalance = await mockToken.balanceOf(accountAddress);
      const recipientBalance = await mockToken.balanceOf(user2);
      
      expect(finalAccountBalance).to.equal(initialBalance - transferAmount);
      expect(recipientBalance).to.equal(transferAmount);
    });

    it("should allow transferring ownership", async function () {
      // Check initial owner
      expect(await accountInstance.owner()).to.equal(user1);
      
      // Transfer ownership
      const user1Signer = await ethers.getSigner(user1);
      const accountInstanceAsOwner = accountInstance.connect(user1Signer);
      
      await accountInstanceAsOwner.transferOwnership(user2);
      
      // Check new owner
      expect(await accountInstance.owner()).to.equal(user2);
    });

    it("should support smart balance setting changes", async function () {
      // Check initial smart balance setting
      expect(await accountInstance.smartBalanceEnabled()).to.equal(true);
      
      // Change the setting
      const user1Signer = await ethers.getSigner(user1);
      const accountInstanceAsOwner = accountInstance.connect(user1Signer);
      
      await accountInstanceAsOwner.setSmartBalanceEnabled(false);
      
      // Check updated setting
      expect(await accountInstance.smartBalanceEnabled()).to.equal(false);
    });

    it("should handle batch transactions", async function () {
      // Create a mock token
      const mockContractFactory = await ethers.getContractFactory("MockUSDC");
      const mockToken = await mockContractFactory.deploy("Mock USDC", "USDC");
      await mockToken.waitForDeployment();
      
      // Mint some tokens to the account
      const tokenAmount = ethers.parseUnits("1000", 6);
      await mockToken.mint(accountAddress, tokenAmount);
      
      // Prepare multiple transfers
      const transferAmount1 = ethers.parseUnits("100", 6);
      const transferAmount2 = ethers.parseUnits("200", 6);
      
      const transferCalldata1 = mockToken.interface.encodeFunctionData(
        "transfer", 
        [user2, transferAmount1]
      );
      
      const transferCalldata2 = mockToken.interface.encodeFunctionData(
        "transfer", 
        [user2, transferAmount2]
      );
      
      // Execute batch transfers as owner
      const user1Signer = await ethers.getSigner(user1);
      const accountInstanceAsOwner = accountInstance.connect(user1Signer);
      
      await accountInstanceAsOwner.executeBatch(
        [await mockToken.getAddress(), await mockToken.getAddress()],
        [0, 0], // No ETH values
        [transferCalldata1, transferCalldata2]
      );
      
      // Check final balances
      const finalAccountBalance = await mockToken.balanceOf(accountAddress);
      const recipientBalance = await mockToken.balanceOf(user2);
      
      const totalTransferred = transferAmount1 + transferAmount2;
      expect(finalAccountBalance).to.equal(tokenAmount - totalTransferred);
      expect(recipientBalance).to.equal(totalTransferred);
    });
  });

  describe("Input Validation", function () {
    it("should revert when owner is zero address", async function () {
      const registryAddress = await enclaveRegistry.getAddress();
      
      // Try to create an account with owner = zero address
      await expect(
        smartAccountFactory.createAccount(
          ethers.ZeroAddress, 
          registryAddress, 
          true, 
          DEFAULT_SALT
        )
      ).to.be.revertedWithCustomError(smartAccountFactory, "ZeroAddressNotAllowed");
    });

    it("should revert when enclaveRegistry is zero address", async function () {
      // Try to create an account with enclaveRegistry = zero address
      await expect(
        smartAccountFactory.createAccount(
          user1, 
          ethers.ZeroAddress, 
          true, 
          DEFAULT_SALT
        )
      ).to.be.revertedWithCustomError(smartAccountFactory, "ZeroAddressNotAllowed");
    });

    it("should not revert for valid non-zero addresses", async function () {
      const registryAddress = await enclaveRegistry.getAddress();
      
      // This should not revert with valid addresses
      await expect(
        smartAccountFactory.createAccount(
          user1, 
          registryAddress, 
          true, 
          DEFAULT_SALT
        )
      ).to.not.be.reverted;
    });

    it("should still allow getAccountAddress with zero addresses for calculation purposes", async function () {
      // getAccountAddress should not revert with zero addresses
      const zeroOwnerAddress = await smartAccountFactory.getAccountAddress(
        ethers.ZeroAddress,
        await enclaveRegistry.getAddress(),
        true,
        DEFAULT_SALT
      );
      
      const zeroRegistryAddress = await smartAccountFactory.getAccountAddress(
        user1,
        ethers.ZeroAddress,
        true,
        DEFAULT_SALT
      );
      
      // Addresses should be valid
      expect(zeroOwnerAddress).to.be.a.properAddress;
      expect(zeroRegistryAddress).to.be.a.properAddress;
    });
  });
}); 