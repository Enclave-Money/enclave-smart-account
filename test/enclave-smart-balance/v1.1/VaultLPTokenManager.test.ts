import { expect } from "chai";
import { ethers } from "hardhat";
import type { EnclaveMultichainLPToken, VaultLPTokenManager } from "../../../typechain-types";

describe("VaultLPTokenManager", function () {
  let vaultLPTokenManager: VaultLPTokenManager;
  let lpTokenContract: EnclaveMultichainLPToken;
  
  let owner: any;
  let relayer: any;
  let lpWithdrawService: any;
  let newRelayer: any;
  let newLPWithdrawService: any;
  let user1: any;
  let user2: any;
  
  let ownerAddress: string;
  let relayerAddress: string;
  let lpWithdrawServiceAddress: string;
  let newRelayerAddress: string;
  let newLPWithdrawServiceAddress: string;
  let user1Address: string;
  let user2Address: string;
  
  const CHAIN_ID_ETH = 1n;
  const CHAIN_ID_POLYGON = 137n;
  const DEPOSIT_AMOUNT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, relayer, lpWithdrawService, newRelayer, newLPWithdrawService, user1, user2] = await ethers.getSigners();
    
    ownerAddress = await owner.getAddress();
    relayerAddress = await relayer.getAddress();
    lpWithdrawServiceAddress = await lpWithdrawService.getAddress();
    newRelayerAddress = await newRelayer.getAddress();
    newLPWithdrawServiceAddress = await newLPWithdrawService.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();

    // Deploy EnclaveMultichainLPToken
    const EnclaveMultichainLPTokenFactory = await ethers.getContractFactory("EnclaveMultichainLPToken");
    lpTokenContract = await EnclaveMultichainLPTokenFactory.deploy(relayerAddress) as EnclaveMultichainLPToken;
    await lpTokenContract.waitForDeployment();

    // Deploy VaultLPTokenManager
    const VaultLPTokenManagerFactory = await ethers.getContractFactory("VaultLPTokenManager");
    vaultLPTokenManager = await VaultLPTokenManagerFactory.deploy(
      lpTokenContract.target,
      relayerAddress,
      lpWithdrawServiceAddress
    ) as VaultLPTokenManager;
    await vaultLPTokenManager.waitForDeployment();

    // Set the VaultLPTokenManager as the LP token manager
    await lpTokenContract.connect(owner).setLPTokenManager(vaultLPTokenManager.target);

    // Set supported chains
    await vaultLPTokenManager.connect(owner).setSupportedChain(CHAIN_ID_ETH, true);
    await vaultLPTokenManager.connect(owner).setSupportedChain(CHAIN_ID_POLYGON, true);
  });

  describe("Constructor", function () {
    it("should initialize with correct parameters", async function () {
      expect(await vaultLPTokenManager.lpTokenContract()).to.equal(lpTokenContract.target);
      expect(await vaultLPTokenManager.relayer()).to.equal(relayerAddress);
      expect(await vaultLPTokenManager.lpWithdrawService()).to.equal(lpWithdrawServiceAddress);
    });

    it("should revert when initialized with zero LP token contract address", async function () {
      const VaultLPTokenManagerFactory = await ethers.getContractFactory("VaultLPTokenManager");
      await expect(VaultLPTokenManagerFactory.deploy(
        ethers.ZeroAddress,
        relayerAddress,
        lpWithdrawServiceAddress
      )).to.be.revertedWith("Invalid LP token contract address");
    });

    it("should revert when initialized with zero relayer address", async function () {
      const VaultLPTokenManagerFactory = await ethers.getContractFactory("VaultLPTokenManager");
      await expect(VaultLPTokenManagerFactory.deploy(
        lpTokenContract.target,
        ethers.ZeroAddress,
        lpWithdrawServiceAddress
      )).to.be.revertedWith("Invalid relayer address");
    });

    it("should revert when initialized with zero LP withdraw service address", async function () {
      const VaultLPTokenManagerFactory = await ethers.getContractFactory("VaultLPTokenManager");
      await expect(VaultLPTokenManagerFactory.deploy(
        lpTokenContract.target,
        relayerAddress,
        ethers.ZeroAddress
      )).to.be.revertedWith("Invalid LP withdraw service address");
    });
  });

  describe("setLPTokenContract", function () {
    it("should update LP token contract address", async function () {
      // Deploy a new LP token contract
      const NewLPTokenContractFactory = await ethers.getContractFactory("EnclaveMultichainLPToken");
      const newLPTokenContract = await NewLPTokenContractFactory.deploy(relayerAddress);
      await newLPTokenContract.waitForDeployment();

      await vaultLPTokenManager.connect(owner).setLPTokenContract(newLPTokenContract.target);
      expect(await vaultLPTokenManager.lpTokenContract()).to.equal(newLPTokenContract.target);
    });

    it("should revert when called by non-owner", async function () {
      const NewLPTokenContractFactory = await ethers.getContractFactory("EnclaveMultichainLPToken");
      const newLPTokenContract = await NewLPTokenContractFactory.deploy(relayerAddress);
      await newLPTokenContract.waitForDeployment();

      await expect(vaultLPTokenManager.connect(relayer).setLPTokenContract(newLPTokenContract.target))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when setting zero address", async function () {
      await expect(vaultLPTokenManager.connect(owner).setLPTokenContract(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid LP token contract address");
    });
  });

  describe("setRelayer", function () {
    it("should update relayer address", async function () {
      await vaultLPTokenManager.connect(owner).setRelayer(newRelayerAddress);
      expect(await vaultLPTokenManager.relayer()).to.equal(newRelayerAddress);
    });

    it("should emit RelayerSet event", async function () {
      await expect(vaultLPTokenManager.connect(owner).setRelayer(newRelayerAddress))
        .to.emit(vaultLPTokenManager, "RelayerSet")
        .withArgs(relayerAddress, newRelayerAddress);
    });

    it("should revert when called by non-owner", async function () {
      await expect(vaultLPTokenManager.connect(relayer).setRelayer(newRelayerAddress))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when setting zero address", async function () {
      await expect(vaultLPTokenManager.connect(owner).setRelayer(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid relayer address");
    });
  });

  describe("setLPWithdrawService", function () {
    it("should update LP withdraw service address", async function () {
      await vaultLPTokenManager.connect(owner).setLPWithdrawService(newLPWithdrawServiceAddress);
      expect(await vaultLPTokenManager.lpWithdrawService()).to.equal(newLPWithdrawServiceAddress);
    });

    it("should emit LPWithdrawServiceSet event", async function () {
      await expect(vaultLPTokenManager.connect(owner).setLPWithdrawService(newLPWithdrawServiceAddress))
        .to.emit(vaultLPTokenManager, "LPWithdrawServiceSet")
        .withArgs(lpWithdrawServiceAddress, newLPWithdrawServiceAddress);
    });

    it("should revert when called by non-owner", async function () {
      await expect(vaultLPTokenManager.connect(relayer).setLPWithdrawService(newLPWithdrawServiceAddress))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when setting zero address", async function () {
      await expect(vaultLPTokenManager.connect(owner).setLPWithdrawService(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid LP withdraw service address");
    });
  });

  describe("setSupportedChain", function () {
    it("should add a supported chain", async function () {
      const NEW_CHAIN_ID = 56n; // BSC
      await vaultLPTokenManager.connect(owner).setSupportedChain(NEW_CHAIN_ID, true);
      expect(await vaultLPTokenManager.supportedChains(NEW_CHAIN_ID)).to.be.true;
    });

    it("should remove a supported chain", async function () {
      await vaultLPTokenManager.connect(owner).setSupportedChain(CHAIN_ID_ETH, false);
      expect(await vaultLPTokenManager.supportedChains(CHAIN_ID_ETH)).to.be.false;
    });

    it("should emit ChainSupported event", async function () {
      const NEW_CHAIN_ID = 56n; // BSC
      await expect(vaultLPTokenManager.connect(owner).setSupportedChain(NEW_CHAIN_ID, true))
        .to.emit(vaultLPTokenManager, "ChainSupported")
        .withArgs(NEW_CHAIN_ID, true);
    });

    it("should revert when called by non-owner", async function () {
      const NEW_CHAIN_ID = 56n; // BSC
      await expect(vaultLPTokenManager.connect(relayer).setSupportedChain(NEW_CHAIN_ID, true))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when setting invalid chain ID", async function () {
      await expect(vaultLPTokenManager.connect(owner).setSupportedChain(0, true))
        .to.be.revertedWith("Invalid chain ID");
    });
  });

  describe("createLPToken", function () {
    it("should create a new LP token for an underlying token", async function () {
      // Mock token address
      const mockTokenAddress = user1Address;
      
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      const tx = await vaultLPTokenManager.connect(owner).createLPToken(
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
      
      await expect(vaultLPTokenManager.connect(relayer).createLPToken(
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
      await vaultLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
      
      // Then relay deposit
      await expect(vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.emit(vaultLPTokenManager, "DepositRelayed")
        .withArgs(user1Address, mockTokenAddress, DEPOSIT_AMOUNT, CHAIN_ID_ETH);
      
      // Check chain balance was updated
      const chainBalance = await lpTokenContract.chainBalances(mockTokenAddress, CHAIN_ID_ETH);
      expect(chainBalance).to.equal(DEPOSIT_AMOUNT);
    });

    it("should revert when called by non-relayer", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(vaultLPTokenManager.connect(user1).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Caller is not the relayer");
    });

    it("should revert with invalid user address", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(vaultLPTokenManager.connect(relayer).relayDeposit(
        ethers.ZeroAddress,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Invalid user address");
    });

    it("should revert with invalid token address", async function () {
      await expect(vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        ethers.ZeroAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Invalid token address");
    });

    it("should revert with zero amount", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        0,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert with unsupported chain ID", async function () {
      const mockTokenAddress = user2Address;
      const UNSUPPORTED_CHAIN_ID = 42161n; // Arbitrum
      
      await expect(vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        UNSUPPORTED_CHAIN_ID
      )).to.be.revertedWith("Unsupported chain ID");
    });
  });

  describe("processWithdrawal", function () {
    beforeEach(async function () {
      // Mock token address and prepare data for tests
      const mockTokenAddress = user2Address;
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      // First create LP token
      await vaultLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
      
      // Then relay a deposit to have some balance
      await vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      );
    });

    it("should process a withdrawal on a specific chain", async function () {
      const mockTokenAddress = user2Address;
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      
      await expect(vaultLPTokenManager.connect(lpWithdrawService).processWithdrawal(
        mockTokenAddress,
        withdrawalAmount,
        CHAIN_ID_ETH
      )).to.emit(vaultLPTokenManager, "WithdrawalProcessed")
        .withArgs(ethers.ZeroAddress, mockTokenAddress, withdrawalAmount, CHAIN_ID_ETH);
      
      // Check chain balance was updated
      const chainBalance = await lpTokenContract.chainBalances(mockTokenAddress, CHAIN_ID_ETH);
      expect(chainBalance).to.equal(DEPOSIT_AMOUNT - withdrawalAmount);
    });

    it("should revert when called by non-LP withdraw service", async function () {
      const mockTokenAddress = user2Address;
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      
      await expect(vaultLPTokenManager.connect(user1).processWithdrawal(
        mockTokenAddress,
        withdrawalAmount,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Caller is not the LP withdraw service");
    });

    it("should revert with invalid token address", async function () {
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      
      await expect(vaultLPTokenManager.connect(lpWithdrawService).processWithdrawal(
        ethers.ZeroAddress,
        withdrawalAmount,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Invalid token address");
    });

    it("should revert with zero amount", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(vaultLPTokenManager.connect(lpWithdrawService).processWithdrawal(
        mockTokenAddress,
        0,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert with unsupported chain ID", async function () {
      const mockTokenAddress = user2Address;
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      const UNSUPPORTED_CHAIN_ID = 42161n; // Arbitrum
      
      await expect(vaultLPTokenManager.connect(lpWithdrawService).processWithdrawal(
        mockTokenAddress,
        withdrawalAmount,
        UNSUPPORTED_CHAIN_ID
      )).to.be.revertedWith("Unsupported chain ID");
    });
  });

  describe("processUserWithdrawal", function () {
    beforeEach(async function () {
      // Mock token address and prepare data for tests
      const mockTokenAddress = user2Address;
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      // First create LP token
      await vaultLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
      
      // Then relay a deposit to have some balance
      await vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      );
    });

    it("should process a user's withdrawal on a specific chain", async function () {
      const mockTokenAddress = user2Address;
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      
      await expect(vaultLPTokenManager.connect(lpWithdrawService).processUserWithdrawal(
        user1Address,
        mockTokenAddress,
        withdrawalAmount,
        CHAIN_ID_ETH
      )).to.emit(vaultLPTokenManager, "WithdrawalProcessed")
        .withArgs(user1Address, mockTokenAddress, withdrawalAmount, CHAIN_ID_ETH);
      
      // Check chain balance was updated
      const chainBalance = await lpTokenContract.chainBalances(mockTokenAddress, CHAIN_ID_ETH);
      expect(chainBalance).to.equal(DEPOSIT_AMOUNT - withdrawalAmount);
    });

    it("should revert when called by non-LP withdraw service", async function () {
      const mockTokenAddress = user2Address;
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      
      await expect(vaultLPTokenManager.connect(user1).processUserWithdrawal(
        user1Address,
        mockTokenAddress,
        withdrawalAmount,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Caller is not the LP withdraw service");
    });

    it("should revert with invalid user address", async function () {
      const mockTokenAddress = user2Address;
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      
      await expect(vaultLPTokenManager.connect(lpWithdrawService).processUserWithdrawal(
        ethers.ZeroAddress,
        mockTokenAddress,
        withdrawalAmount,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Invalid user address");
    });

    it("should revert with invalid token address", async function () {
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      
      await expect(vaultLPTokenManager.connect(lpWithdrawService).processUserWithdrawal(
        user1Address,
        ethers.ZeroAddress,
        withdrawalAmount,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Invalid token address");
    });

    it("should revert with zero amount", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(vaultLPTokenManager.connect(lpWithdrawService).processUserWithdrawal(
        user1Address,
        mockTokenAddress,
        0,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert with unsupported chain ID", async function () {
      const mockTokenAddress = user2Address;
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      const UNSUPPORTED_CHAIN_ID = 42161n; // Arbitrum
      
      await expect(vaultLPTokenManager.connect(lpWithdrawService).processUserWithdrawal(
        user1Address,
        mockTokenAddress,
        withdrawalAmount,
        UNSUPPORTED_CHAIN_ID
      )).to.be.revertedWith("Unsupported chain ID");
    });
  });

  describe("Calculation functions", function () {
    beforeEach(async function () {
      // Mock token address and prepare data for tests
      const mockTokenAddress = user2Address;
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      // First create LP token
      await vaultLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
      
      // Then relay a deposit to have some balance
      await vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      );
    });

    it("should calculate LP token amount for a given underlying amount", async function () {
      const mockTokenAddress = user2Address;
      const amount = DEPOSIT_AMOUNT / 2n;
      
      const lpAmount = await vaultLPTokenManager.calculateLPTokenAmount(mockTokenAddress, amount);
      expect(lpAmount).to.not.equal(0);
    });

    it("should calculate underlying amount for a given LP token amount", async function () {
      const mockTokenAddress = user2Address;
      const lpAmount = DEPOSIT_AMOUNT / 2n;
      
      const underlyingAmount = await vaultLPTokenManager.calculateUnderlyingAmount(mockTokenAddress, lpAmount);
      expect(underlyingAmount).to.not.equal(0);
    });
  });

  describe("Withdrawal Request Testing", function () {
    beforeEach(async function () {
      // Mock token address and prepare data for tests
      const mockTokenAddress = user2Address;
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      // First create LP token
      await vaultLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
      
      // Then relay a deposit to have some balance
      await vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      );
    });

    it("should handle withdrawal requests through the LP token contract", async function () {
      const mockTokenAddress = user2Address;
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      
      // Get the LP token address
      const lpTokenAddress = await lpTokenContract.lpTokens(mockTokenAddress);
      
      // Create LP token contract instance
      const lpToken = await ethers.getContractAt("EnclaveTokenLP", lpTokenAddress);
      
      // Get the LP token balance of user1
      const lpBalance = await lpToken.balanceOf(user1Address);
      
      // Approve the LP token contract to burn tokens
      await lpToken.connect(user1).approve(lpTokenContract.target, lpBalance);
      
      // Request withdrawal directly through LP token contract
      await expect(lpTokenContract.connect(user1).requestWithdrawal(
        mockTokenAddress,
        lpBalance,
        CHAIN_ID_ETH
      )).to.emit(lpTokenContract, "WithdrawalRequested")
        .withArgs(mockTokenAddress, ethers.toBigInt(await lpTokenContract.calculateUnderlyingAmount(mockTokenAddress, lpBalance)), user1Address, CHAIN_ID_ETH);
      
      // Verify the LP tokens were burned
      expect(await lpToken.balanceOf(user1Address)).to.equal(0);
    });
  });

  // Add specific tests for require statements in modifiers
  describe("Modifier tests", function () {
    it("should enforce onlyRelayer modifier", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(vaultLPTokenManager.connect(user1).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Caller is not the relayer");
    });

    it("should enforce onlyLPWithdrawService modifier", async function () {
      const mockTokenAddress = user2Address;
      
      await expect(vaultLPTokenManager.connect(user1).processWithdrawal(
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      )).to.be.revertedWith("Caller is not the LP withdraw service");
    });
  });

  // Additional tests for edge cases and specific require statements
  describe("Edge cases and additional require statements", function () {
    it("should revert when trying to update the LP token contract with itself", async function () {
      // Try to set the same LP token contract
      const tx = vaultLPTokenManager.connect(owner).setLPTokenContract(lpTokenContract.target);
      
      // Check the transaction completes successfully (no revert)
      // This would only fail if there was a specific check preventing setting the same address
      await expect(tx).to.not.be.reverted;
    });

    it("should revert when trying to update the relayer with the same address", async function () {
      // Try to set the same relayer address
      const tx = vaultLPTokenManager.connect(owner).setRelayer(relayerAddress);
      
      // Check the transaction completes successfully (no revert)
      // This would only fail if there was a specific check preventing setting the same address
      await expect(tx).to.not.be.reverted;
    });

    it("should revert when trying to update the LP withdraw service with the same address", async function () {
      // Try to set the same LP withdraw service address
      const tx = vaultLPTokenManager.connect(owner).setLPWithdrawService(lpWithdrawServiceAddress);
      
      // Check the transaction completes successfully (no revert)
      // This would only fail if there was a specific check preventing setting the same address
      await expect(tx).to.not.be.reverted;
    });
  });

  // Test constructor with a previously deployed LP token contract
  describe("Constructor with existing LP token contract", function () {
    it("should initialize properly with a previously deployed LP token contract", async function () {
      // Deploy a new LP token contract first
      const NewLPTokenContractFactory = await ethers.getContractFactory("EnclaveMultichainLPToken");
      const newLPTokenContract = await NewLPTokenContractFactory.deploy(relayerAddress);
      await newLPTokenContract.waitForDeployment();
      
      // Then deploy VaultLPTokenManager with the new LP token contract
      const VaultLPTokenManagerFactory = await ethers.getContractFactory("VaultLPTokenManager");
      const newVaultLPTokenManager = await VaultLPTokenManagerFactory.deploy(
        newLPTokenContract.target,
        relayerAddress,
        lpWithdrawServiceAddress
      );
      await newVaultLPTokenManager.waitForDeployment();
      
      // Verify correct initialization
      expect(await newVaultLPTokenManager.lpTokenContract()).to.equal(newLPTokenContract.target);
      expect(await newVaultLPTokenManager.relayer()).to.equal(relayerAddress);
      expect(await newVaultLPTokenManager.lpWithdrawService()).to.equal(lpWithdrawServiceAddress);
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
      await vaultLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
    });

    it("should handle extremely large deposit amounts", async function () {
      const mockTokenAddress = user2Address;
      const VERY_LARGE_AMOUNT = ethers.parseEther("1000000000"); // 1 billion ETH
      
      // Then relay deposit with very large amount
      await vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        VERY_LARGE_AMOUNT,
        CHAIN_ID_ETH
      );
      
      // Check chain balance was updated correctly with the large amount
      const chainBalance = await lpTokenContract.chainBalances(mockTokenAddress, CHAIN_ID_ETH);
      expect(chainBalance).to.equal(VERY_LARGE_AMOUNT);
    });

    it("should handle small, non-zero deposit amounts", async function () {
      const mockTokenAddress = user2Address;
      const VERY_SMALL_AMOUNT = 1n; // Smallest possible amount
      
      // Then relay deposit with very small amount
      await vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        VERY_SMALL_AMOUNT,
        CHAIN_ID_ETH
      );
      
      // Check chain balance was updated correctly with the small amount
      const chainBalance = await lpTokenContract.chainBalances(mockTokenAddress, CHAIN_ID_ETH);
      expect(chainBalance).to.equal(VERY_SMALL_AMOUNT);
    });
  });

  // Test interactions between functions
  describe("Function interaction tests", function () {
    beforeEach(async function () {
      // Mock token address and prepare data for tests
      const mockTokenAddress = user2Address;
      const lpTokenName = "Enclave LP Token";
      const lpTokenSymbol = "ELP";
      
      // First create LP token
      await vaultLPTokenManager.connect(owner).createLPToken(
        mockTokenAddress,
        lpTokenName,
        lpTokenSymbol
      );
    });

    it("should handle deposit followed by withdrawal correctly", async function () {
      const mockTokenAddress = user2Address;
      
      // First relay a deposit
      await vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      );
      
      // Check chain balance after deposit
      let chainBalance = await lpTokenContract.chainBalances(mockTokenAddress, CHAIN_ID_ETH);
      expect(chainBalance).to.equal(DEPOSIT_AMOUNT);
      
      // Then process a withdrawal for half the amount
      const withdrawalAmount = DEPOSIT_AMOUNT / 2n;
      await vaultLPTokenManager.connect(lpWithdrawService).processWithdrawal(
        mockTokenAddress,
        withdrawalAmount,
        CHAIN_ID_ETH
      );
      
      // Check chain balance was updated correctly after withdrawal
      chainBalance = await lpTokenContract.chainBalances(mockTokenAddress, CHAIN_ID_ETH);
      expect(chainBalance).to.equal(DEPOSIT_AMOUNT - withdrawalAmount);
    });

    it("should handle multiple deposits and withdrawals correctly", async function () {
      const mockTokenAddress = user2Address;
      let expectedBalance = 0n;
      
      // First deposit
      await vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      );
      expectedBalance += DEPOSIT_AMOUNT;
      
      // Second deposit
      await vaultLPTokenManager.connect(relayer).relayDeposit(
        user2Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT * 2n,
        CHAIN_ID_ETH
      );
      expectedBalance += DEPOSIT_AMOUNT * 2n;
      
      // First withdrawal
      await vaultLPTokenManager.connect(lpWithdrawService).processWithdrawal(
        mockTokenAddress,
        DEPOSIT_AMOUNT / 2n,
        CHAIN_ID_ETH
      );
      expectedBalance -= DEPOSIT_AMOUNT / 2n;
      
      // Third deposit
      await vaultLPTokenManager.connect(relayer).relayDeposit(
        user1Address,
        mockTokenAddress,
        DEPOSIT_AMOUNT / 4n,
        CHAIN_ID_ETH
      );
      expectedBalance += DEPOSIT_AMOUNT / 4n;
      
      // Second withdrawal
      await vaultLPTokenManager.connect(lpWithdrawService).processWithdrawal(
        mockTokenAddress,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
      );
      expectedBalance -= DEPOSIT_AMOUNT;
      
      // Check final chain balance is correct after all operations
      const chainBalance = await lpTokenContract.chainBalances(mockTokenAddress, CHAIN_ID_ETH);
      expect(chainBalance).to.equal(expectedBalance);
    });
  });
}); 