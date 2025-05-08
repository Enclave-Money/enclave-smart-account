import { expect } from "chai";
import { ethers } from "hardhat";
import type { EnclaveMultichainLPToken, EnclaveMultichainLPTokenManager } from "../../../typechain-types";

describe("EnclaveMultichainLPTokenManager", function () {
  let enclaveMultichainLPTokenManager: EnclaveMultichainLPTokenManager;
  let lpTokenContract: EnclaveMultichainLPToken;
  
  let owner: any;
  let relayer: any;
  let newRelayer: any;
  let user1: any;
  let user2: any;
  
  let ownerAddress: string;
  let relayerAddress: string;
  let newRelayerAddress: string;
  let user1Address: string;
  let user2Address: string;
  
  const CHAIN_ID_ETH = 1n;
  const CHAIN_ID_POLYGON = 137n;
  const DEPOSIT_AMOUNT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, relayer, newRelayer, user1, user2] = await ethers.getSigners();
    
    ownerAddress = await owner.getAddress();
    relayerAddress = await relayer.getAddress();
    newRelayerAddress = await newRelayer.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();

    // Deploy EnclaveMultichainLPToken
    const EnclaveMultichainLPTokenFactory = await ethers.getContractFactory("EnclaveMultichainLPToken");
    lpTokenContract = await EnclaveMultichainLPTokenFactory.deploy(relayerAddress) as EnclaveMultichainLPToken;
    await lpTokenContract.waitForDeployment();

    // Deploy EnclaveMultichainLPTokenManager
    const EnclaveMultichainLPTokenManagerFactory = await ethers.getContractFactory("EnclaveMultichainLPTokenManager");
    enclaveMultichainLPTokenManager = await EnclaveMultichainLPTokenManagerFactory.deploy(
      lpTokenContract.target,
      relayerAddress
    ) as EnclaveMultichainLPTokenManager;
    await enclaveMultichainLPTokenManager.waitForDeployment();

    // Set the EnclaveMultichainLPTokenManager as the LP token manager
    await lpTokenContract.connect(owner).setLPTokenManager(enclaveMultichainLPTokenManager.target);

    // Set supported chains
    await enclaveMultichainLPTokenManager.connect(owner).setSupportedChain(CHAIN_ID_ETH, true);
    await enclaveMultichainLPTokenManager.connect(owner).setSupportedChain(CHAIN_ID_POLYGON, true);
  });

  describe("Constructor", function () {
    it("should initialize with correct parameters", async function () {
      expect(await enclaveMultichainLPTokenManager.lpTokenContract()).to.equal(lpTokenContract.target);
      expect(await enclaveMultichainLPTokenManager.relayer()).to.equal(relayerAddress);
    });

    it("should revert when initialized with zero LP token contract address", async function () {
      const EnclaveMultichainLPTokenManagerFactory = await ethers.getContractFactory("EnclaveMultichainLPTokenManager");
      await expect(EnclaveMultichainLPTokenManagerFactory.deploy(
        ethers.ZeroAddress,
        relayerAddress
      )).to.be.revertedWith("Invalid LP token contract address");
    });

    it("should revert when initialized with zero relayer address", async function () {
      const EnclaveMultichainLPTokenManagerFactory = await ethers.getContractFactory("EnclaveMultichainLPTokenManager");
      await expect(EnclaveMultichainLPTokenManagerFactory.deploy(
        lpTokenContract.target,
        ethers.ZeroAddress
      )).to.be.revertedWith("Invalid relayer address");
    });
  });

  describe("setLPTokenContract", function () {
    it("should update LP token contract address", async function () {
      // Deploy a new LP token contract
      const NewLPTokenContractFactory = await ethers.getContractFactory("EnclaveMultichainLPToken");
      const newLPTokenContract = await NewLPTokenContractFactory.deploy(relayerAddress);
      await newLPTokenContract.waitForDeployment();

      await enclaveMultichainLPTokenManager.connect(owner).setLPTokenContract(newLPTokenContract.target);
      expect(await enclaveMultichainLPTokenManager.lpTokenContract()).to.equal(newLPTokenContract.target);
    });

    it("should revert when called by non-owner", async function () {
      const NewLPTokenContractFactory = await ethers.getContractFactory("EnclaveMultichainLPToken");
      const newLPTokenContract = await NewLPTokenContractFactory.deploy(relayerAddress);
      await newLPTokenContract.waitForDeployment();

      await expect(enclaveMultichainLPTokenManager.connect(relayer).setLPTokenContract(newLPTokenContract.target))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when setting zero address", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(owner).setLPTokenContract(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid LP token contract address");
    });
  });

  describe("setRelayer", function () {
    it("should update relayer address", async function () {
      await enclaveMultichainLPTokenManager.connect(owner).setRelayer(newRelayerAddress);
      expect(await enclaveMultichainLPTokenManager.relayer()).to.equal(newRelayerAddress);
    });

    it("should emit RelayerSet event", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(owner).setRelayer(newRelayerAddress))
        .to.emit(enclaveMultichainLPTokenManager, "RelayerSet")
        .withArgs(relayerAddress, newRelayerAddress);
    });

    it("should revert when called by non-owner", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(relayer).setRelayer(newRelayerAddress))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when setting zero address", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(owner).setRelayer(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid relayer address");
    });
  });

  describe("setSupportedChain", function () {
    it("should add a supported chain", async function () {
      const NEW_CHAIN_ID = 56n; // BSC
      await enclaveMultichainLPTokenManager.connect(owner).setSupportedChain(NEW_CHAIN_ID, true);
      expect(await enclaveMultichainLPTokenManager.supportedChains(NEW_CHAIN_ID)).to.be.true;
    });

    it("should remove a supported chain", async function () {
      await enclaveMultichainLPTokenManager.connect(owner).setSupportedChain(CHAIN_ID_ETH, false);
      expect(await enclaveMultichainLPTokenManager.supportedChains(CHAIN_ID_ETH)).to.be.false;
    });

    it("should emit ChainSupported event", async function () {
      const NEW_CHAIN_ID = 56n; // BSC
      await expect(enclaveMultichainLPTokenManager.connect(owner).setSupportedChain(NEW_CHAIN_ID, true))
        .to.emit(enclaveMultichainLPTokenManager, "ChainSupported")
        .withArgs(NEW_CHAIN_ID, true);
    });

    it("should revert when called by non-owner", async function () {
      const NEW_CHAIN_ID = 56n; // BSC
      await expect(enclaveMultichainLPTokenManager.connect(relayer).setSupportedChain(NEW_CHAIN_ID, true))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when setting invalid chain ID", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(owner).setSupportedChain(0, true))
        .to.be.revertedWith("Invalid chain ID");
    });
  });

  describe("createLPToken", function () {
    it("should create a new LP token for an underlying token", async function () {
      // Mock token address
      const mockTokenAddress = user1Address;
      
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      const tx = await enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
      
      const receipt = await tx.wait();
      
      // Get the event from the LP token contract
      const lpTokenCreatedEvents = receipt?.logs.filter(
        (log: any) => log.fragment && log.fragment.name === 'LPTokenCreated'
      );
      
      expect(lpTokenCreatedEvents).to.not.be.undefined;
      
      // Verify LP token was created
      const lpTokenAddress = await lpTokenContract.lpTokens(mockTokenAddress);
      expect(lpTokenAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should revert when called by non-owner", async function () {
      const mockTokenAddress = user1Address;
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      await expect(enclaveMultichainLPTokenManager.connect(relayer).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      )).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("relayDeposit", function () {
    it("should record a deposit from a user on a specific chain", async function () {
      // Mock token address
      const mockTokenAddress = user2Address;
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      // First create LP token
      await enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
      
      // Then relay deposit
      await expect(enclaveMultichainLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.emit(enclaveMultichainLPTokenManager, "DepositRelayed")
        .withArgs(user1Address, mockTokenAddress, DEPOSIT_AMOUNT, CHAIN_ID_ETH);
      
      // Get the LP token address
      const lpTokenAddress = await lpTokenContract.lpTokens(mockTokenAddress);
      
      // Create LP token contract instance
      const lpToken = await ethers.getContractAt("EnclaveTokenLP", lpTokenAddress);
      
      // Check that LP tokens were minted to the user (1:1 ratio in simplified contract)
      expect(await lpToken.balanceOf(user1Address)).to.equal(DEPOSIT_AMOUNT);
    });

    it("should revert when called by non-relayer", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(enclaveMultichainLPTokenManager.connect(user1).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Caller is not the relayer");
    });

    it("should revert with invalid user address", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(enclaveMultichainLPTokenManager.connect(relayer).relayDeposit(
        ethers.ZeroAddress,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Invalid user address");
    });

    it("should revert with invalid token address", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        ethers.ZeroAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Invalid token address");
    });

    it("should revert with zero amount", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(enclaveMultichainLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        0,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert with unsupported chain ID", async function () {
      const mockTokenAddress = user2Address;
      const UNSUPPORTED_CHAIN_ID = 42161n; // Arbitrum
      
      await expect(enclaveMultichainLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        UNSUPPORTED_CHAIN_ID
      )).to.be.revertedWith("Unsupported chain ID");
    });
  });

  describe("Withdrawal Requests", function () {
    beforeEach(async function () {
      // Mock token address and prepare data for tests
      const mockTokenAddress = user2Address;
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      // First create LP token
      await enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
      
      // Then relay a deposit to have some balance
      await enclaveMultichainLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      );
    });

    it("should process withdrawal request through LP token contract", async function () {
      const mockTokenAddress = user2Address;
      
      // Get the LP token address
      const lpTokenAddress = await lpTokenContract.lpTokens(mockTokenAddress);
      
      // Get LP token contract instance
      const lpToken = await ethers.getContractAt("EnclaveTokenLP", lpTokenAddress);
      
      // Initial LP token balance
      const initialBalance = await lpToken.balanceOf(user1Address);
      expect(initialBalance).to.equal(DEPOSIT_AMOUNT);
      
      // Approve LP tokens to be burned by the LP token contract
      await lpToken.connect(user1).approve(lpTokenContract.target, initialBalance);
      
      // Request withdrawal
      await expect(lpTokenContract.connect(user1).requestWithdrawal(
        mockTokenAddress,
        initialBalance,
        CHAIN_ID_ETH
      )).to.emit(lpTokenContract, "WithdrawalRequested")
        .withArgs(mockTokenAddress, initialBalance, user1Address, CHAIN_ID_ETH);
      
      // Verify LP tokens were burned
      expect(await lpToken.balanceOf(user1Address)).to.equal(0);
    });
  });

  // Add tests for modifier validation
  describe("Modifier tests", function () {
    it("should enforce onlyRelayer modifier", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(enclaveMultichainLPTokenManager.connect(user1).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Caller is not the relayer");
    });
  });

  // Edge cases and special conditions
  describe("Edge cases and additional require statements", function () {
    it("should handle contract updates without errors", async function () {
      // Try to set the same LP token contract
      const tx = enclaveMultichainLPTokenManager.connect(owner).setLPTokenContract(lpTokenContract.target);
      
      // Check the transaction completes successfully (no revert)
      await expect(tx).to.not.be.reverted;
    });

    it("should handle updating relayer with same address", async function () {
      // Try to set the same relayer address
      const tx = enclaveMultichainLPTokenManager.connect(owner).setRelayer(relayerAddress);
      
      // Check the transaction completes successfully (no revert)
      await expect(tx).to.not.be.reverted;
    });
  });

  // Test constructor with previously deployed LP token contract
  describe("Constructor with existing LP token contract", function () {
    it("should initialize properly with a previously deployed LP token contract", async function () {
      // Deploy a new LP token contract first
      const NewLPTokenContractFactory = await ethers.getContractFactory("EnclaveMultichainLPToken");
      const newLPTokenContract = await NewLPTokenContractFactory.deploy(relayerAddress);
      await newLPTokenContract.waitForDeployment();
      
      // Then deploy EnclaveMultichainLPTokenManager with the new LP token contract
      const EnclaveMultichainLPTokenManagerFactory = await ethers.getContractFactory("EnclaveMultichainLPTokenManager");
      const newEnclaveMultichainLPTokenManager = await EnclaveMultichainLPTokenManagerFactory.deploy(
        newLPTokenContract.target,
        relayerAddress
      );
      await newEnclaveMultichainLPTokenManager.waitForDeployment();
      
      // Verify correct initialization
      expect(await newEnclaveMultichainLPTokenManager.lpTokenContract()).to.equal(newLPTokenContract.target);
      expect(await newEnclaveMultichainLPTokenManager.relayer()).to.equal(relayerAddress);
    });
  });

  // Add tests for boundary conditions
  describe("Boundary conditions", function () {
    beforeEach(async function () {
      // Mock token address and prepare data for tests
      const mockTokenAddress = user2Address;
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      // First create LP token
      await enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
    });

    it("should handle extremely large deposit amounts", async function () {
      const mockTokenAddress = user2Address;
      const VERY_LARGE_AMOUNT = ethers.parseEther("1000000000"); // 1 billion ETH
      
      // Get the LP token address
      const lpTokenAddress = await lpTokenContract.lpTokens(mockTokenAddress);
      
      // Create LP token contract instance
      const lpToken = await ethers.getContractAt("EnclaveTokenLP", lpTokenAddress);
      
      // Then relay deposit with very large amount
      await enclaveMultichainLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        VERY_LARGE_AMOUNT,
        CHAIN_ID_ETH
      );
      
      // Check LP tokens were minted correctly with the large amount (1:1 ratio)
      expect(await lpToken.balanceOf(user1Address)).to.equal(VERY_LARGE_AMOUNT);
    });

    it("should handle small, non-zero deposit amounts", async function () {
      const mockTokenAddress = user2Address;
      const VERY_SMALL_AMOUNT = 1n; // Smallest possible amount
      
      // Get the LP token address
      const lpTokenAddress = await lpTokenContract.lpTokens(mockTokenAddress);
      
      // Create LP token contract instance
      const lpToken = await ethers.getContractAt("EnclaveTokenLP", lpTokenAddress);
      
      // Then relay deposit with very small amount
      await enclaveMultichainLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        VERY_SMALL_AMOUNT,
        CHAIN_ID_ETH
      );
      
      // Check LP tokens were minted correctly with the small amount (1:1 ratio)
      expect(await lpToken.balanceOf(user1Address)).to.equal(VERY_SMALL_AMOUNT);
    });
  });
}); 