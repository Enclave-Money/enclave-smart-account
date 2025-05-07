import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("VaultLPTokenManager", function () {
  let lpTokenManager: Contract;
  let lpTokenContract: Contract;
  let mockToken: Contract;
  let owner: Signer;
  let relayer: Signer;
  let lpWithdrawService: Signer;
  let user1: Signer;
  let user2: Signer;
  let addresses: { [key: string]: string };

  const tokenAmount = ethers.parseEther("100");
  const smallerAmount = ethers.parseEther("50");
  const chainId1 = 1; // Ethereum Mainnet
  const chainId2 = 137; // Polygon

  beforeEach(async function () {
    [owner, relayer, lpWithdrawService, user1, user2] = await ethers.getSigners();
    
    addresses = {
      owner: await owner.getAddress(),
      relayer: await relayer.getAddress(),
      lpWithdrawService: await lpWithdrawService.getAddress(),
      user1: await user1.getAddress(),
      user2: await user2.getAddress()
    };

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockUSDC");
    mockToken = await MockToken.deploy("Mock Token", "MTK");

    // Deploy the LP token contract with a temporary address (will update later)
    const EnclaveMultichainLPToken = await ethers.getContractFactory("EnclaveMultichainLPToken");
    lpTokenContract = await EnclaveMultichainLPToken.deploy(addresses.owner); // Use owner address instead of zero address

    // Deploy the LP token manager
    const VaultLPTokenManager = await ethers.getContractFactory("VaultLPTokenManager");
    lpTokenManager = await VaultLPTokenManager.deploy(
      lpTokenContract.target,
      addresses.relayer,
      addresses.lpWithdrawService
    );

    // Now set the LP token manager address in the LP token contract
    await lpTokenContract.setLPTokenManager(lpTokenManager.target);

    // Transfer ownership of LP token contract to the owner
    await lpTokenContract.transferOwnership(addresses.owner);
  });

  describe("Initialization", function () {
    it("should be initialized with correct values", async function () {
      expect(await lpTokenManager.lpTokenContract()).to.equal(lpTokenContract.target);
      expect(await lpTokenManager.relayer()).to.equal(addresses.relayer);
      expect(await lpTokenManager.lpWithdrawService()).to.equal(addresses.lpWithdrawService);
      expect(await lpTokenManager.owner()).to.equal(addresses.owner);
    });
  });

  describe("Access Control", function () {
    it("should allow owner to update LP token contract", async function () {
      const newLPToken = await (await ethers.getContractFactory("EnclaveMultichainLPToken")).deploy(lpTokenManager.target);
      
      await lpTokenManager.connect(owner).setLPTokenContract(newLPToken.target);
      expect(await lpTokenManager.lpTokenContract()).to.equal(newLPToken.target);
    });

    it("should allow owner to update relayer", async function () {
      await expect(lpTokenManager.connect(owner).setRelayer(addresses.user1))
        .to.emit(lpTokenManager, "RelayerSet")
        .withArgs(addresses.relayer, addresses.user1);
      
      expect(await lpTokenManager.relayer()).to.equal(addresses.user1);
    });

    it("should allow owner to update LP withdraw service", async function () {
      await expect(lpTokenManager.connect(owner).setLPWithdrawService(addresses.user1))
        .to.emit(lpTokenManager, "LPWithdrawServiceSet")
        .withArgs(addresses.lpWithdrawService, addresses.user1);
      
      expect(await lpTokenManager.lpWithdrawService()).to.equal(addresses.user1);
    });

    it("should revert when non-owner tries to update LP token contract", async function () {
      const newLPToken = await (await ethers.getContractFactory("EnclaveMultichainLPToken")).deploy(lpTokenManager.target);
      
      await expect(lpTokenManager.connect(user1).setLPTokenContract(newLPToken.target))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to update relayer", async function () {
      await expect(lpTokenManager.connect(user1).setRelayer(addresses.user2))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to update LP withdraw service", async function () {
      await expect(lpTokenManager.connect(user1).setLPWithdrawService(addresses.user2))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Chain Management", function () {
    it("should allow owner to add supported chains", async function () {
      await expect(lpTokenManager.connect(owner).setSupportedChain(chainId1, true))
        .to.emit(lpTokenManager, "ChainSupported")
        .withArgs(chainId1, true);
      
      expect(await lpTokenManager.supportedChains(chainId1)).to.be.true;
    });

    it("should allow owner to remove supported chains", async function () {
      // First add a chain
      await lpTokenManager.connect(owner).setSupportedChain(chainId1, true);
      expect(await lpTokenManager.supportedChains(chainId1)).to.be.true;
      
      // Then remove it
      await expect(lpTokenManager.connect(owner).setSupportedChain(chainId1, false))
        .to.emit(lpTokenManager, "ChainSupported")
        .withArgs(chainId1, false);
      
      expect(await lpTokenManager.supportedChains(chainId1)).to.be.false;
    });

    it("should revert when non-owner tries to modify supported chains", async function () {
      await expect(lpTokenManager.connect(user1).setSupportedChain(chainId1, true))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when setting supported chain with invalid chain ID", async function () {
      await expect(lpTokenManager.connect(owner).setSupportedChain(0, true))
        .to.be.revertedWith("Invalid chain ID");
    });
  });

  describe("LP Token Creation", function () {
    it("should allow owner to create LP tokens", async function () {
      // First add supported chain
      await lpTokenManager.connect(owner).setSupportedChain(chainId1, true);
      
      await lpTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "LP Mock Token",
        "LPMTK"
      );
      
      // Verify the LP token creation was forwarded to the LP token contract
      expect(await lpTokenContract.lpTokens(mockToken.target)).to.not.equal(ethers.ZeroAddress);
    });

    it("should revert when non-owner tries to create LP tokens", async function () {
      await expect(lpTokenManager.connect(user1).createLPToken(
        mockToken.target,
        "LP Mock Token",
        "LPMTK"
      ))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Deposit Relay", function () {
    beforeEach(async function () {
      // Setup for deposit tests
      await lpTokenManager.connect(owner).setSupportedChain(chainId1, true);
      
      await lpTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "LP Mock Token",
        "LPMTK"
      );
    });

    it("should allow relayer to relay deposits", async function () {
      await expect(lpTokenManager.connect(relayer).relayDeposit(
        addresses.user1,
        mockToken.target,
        tokenAmount,
        chainId1
      ))
        .to.emit(lpTokenManager, "DepositRelayed")
        .withArgs(addresses.user1, mockToken.target, tokenAmount, chainId1);
    });

    it("should revert when non-relayer tries to relay deposits", async function () {
      await expect(lpTokenManager.connect(user1).relayDeposit(
        addresses.user1,
        mockToken.target,
        tokenAmount,
        chainId1
      ))
        .to.be.revertedWith("Caller is not the relayer");
    });

    it("should revert deposit relay for unsupported chain", async function () {
      const unsupportedChain = 999;
      
      await expect(lpTokenManager.connect(relayer).relayDeposit(
        addresses.user1,
        mockToken.target,
        tokenAmount,
        unsupportedChain
      ))
        .to.be.revertedWith("Unsupported chain ID");
    });

    it("should validate input parameters", async function () {
      // Zero address for user
      await expect(lpTokenManager.connect(relayer).relayDeposit(
        ethers.ZeroAddress,
        mockToken.target,
        tokenAmount,
        chainId1
      ))
        .to.be.revertedWith("Invalid user address");
      
      // Zero address for token
      await expect(lpTokenManager.connect(relayer).relayDeposit(
        addresses.user1,
        ethers.ZeroAddress,
        tokenAmount,
        chainId1
      ))
        .to.be.revertedWith("Invalid token address");
      
      // Zero amount
      await expect(lpTokenManager.connect(relayer).relayDeposit(
        addresses.user1,
        mockToken.target,
        0,
        chainId1
      ))
        .to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Withdrawal Processing", function () {
    beforeEach(async function () {
      // Setup for withdrawal tests
      await lpTokenManager.connect(owner).setSupportedChain(chainId1, true);
      
      await lpTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "LP Mock Token",
        "LPMTK"
      );
      
      // Record a deposit to have something to withdraw
      await lpTokenManager.connect(relayer).relayDeposit(
        addresses.user1,
        mockToken.target,
        tokenAmount,
        chainId1
      );
    });

    it("should allow LP withdraw service to process withdrawals", async function () {
      await expect(lpTokenManager.connect(lpWithdrawService).processWithdrawal(
        mockToken.target,
        smallerAmount,
        chainId1
      ))
        .to.emit(lpTokenManager, "WithdrawalProcessed")
        .withArgs(ethers.ZeroAddress, mockToken.target, smallerAmount, chainId1);
      
      // Verify chain balance decreased
      expect(await lpTokenContract.chainBalances(mockToken.target, chainId1)).to.equal(tokenAmount - smallerAmount);
    });

    it("should allow LP withdraw service to process user withdrawals", async function () {
      await expect(lpTokenManager.connect(lpWithdrawService).processUserWithdrawal(
        addresses.user1,
        mockToken.target,
        smallerAmount,
        chainId1
      ))
        .to.emit(lpTokenManager, "WithdrawalProcessed")
        .withArgs(addresses.user1, mockToken.target, smallerAmount, chainId1);
      
      // Verify chain balance decreased
      expect(await lpTokenContract.chainBalances(mockToken.target, chainId1)).to.equal(tokenAmount - smallerAmount);
    });

    it("should revert when non-LP withdraw service tries to process withdrawals", async function () {
      await expect(lpTokenManager.connect(user1).processWithdrawal(
        mockToken.target,
        smallerAmount,
        chainId1
      ))
        .to.be.revertedWith("Caller is not the LP withdraw service");
    });

    it("should revert when non-LP withdraw service tries to process user withdrawals", async function () {
      await expect(lpTokenManager.connect(user1).processUserWithdrawal(
        addresses.user1,
        mockToken.target,
        smallerAmount,
        chainId1
      ))
        .to.be.revertedWith("Caller is not the LP withdraw service");
    });

    it("should revert withdrawal for unsupported chain", async function () {
      const unsupportedChain = 999;
      
      await expect(lpTokenManager.connect(lpWithdrawService).processWithdrawal(
        mockToken.target,
        smallerAmount,
        unsupportedChain
      ))
        .to.be.revertedWith("Unsupported chain ID");
    });

    it("should validate input parameters for user withdrawals", async function () {
      // Zero address for user
      await expect(lpTokenManager.connect(lpWithdrawService).processUserWithdrawal(
        ethers.ZeroAddress,
        mockToken.target,
        smallerAmount,
        chainId1
      ))
        .to.be.revertedWith("Invalid user address");
      
      // Zero address for token
      await expect(lpTokenManager.connect(lpWithdrawService).processUserWithdrawal(
        addresses.user1,
        ethers.ZeroAddress,
        smallerAmount,
        chainId1
      ))
        .to.be.revertedWith("Invalid token address");
      
      // Zero amount
      await expect(lpTokenManager.connect(lpWithdrawService).processUserWithdrawal(
        addresses.user1,
        mockToken.target,
        0,
        chainId1
      ))
        .to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Setup for view function tests
      await lpTokenManager.connect(owner).setSupportedChain(chainId1, true);
      
      await lpTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "LP Mock Token",
        "LPMTK"
      );
      
      // Record a deposit to have data for calculations
      await lpTokenManager.connect(relayer).relayDeposit(
        addresses.user1,
        mockToken.target,
        tokenAmount,
        chainId1
      );
    });

    it("should correctly calculate LP token amount", async function () {
      const additionalDeposit = ethers.parseEther("30");
      
      const calculatedViaManager = await lpTokenManager.calculateLPTokenAmount(
        mockToken.target,
        additionalDeposit
      );
      
      const calculatedDirectly = await lpTokenContract.calculateLPTokenAmount(
        mockToken.target,
        additionalDeposit
      );
      
      expect(calculatedViaManager).to.equal(calculatedDirectly);
    });

    it("should correctly calculate underlying amount", async function () {
      const lpTokenAmount = ethers.parseEther("30");
      
      const calculatedViaManager = await lpTokenManager.calculateUnderlyingAmount(
        mockToken.target,
        lpTokenAmount
      );
      
      const calculatedDirectly = await lpTokenContract.calculateUnderlyingAmount(
        mockToken.target,
        lpTokenAmount
      );
      
      expect(calculatedViaManager).to.equal(calculatedDirectly);
    });
  });

  it("should deploy successfully", async function () {
    // Simple test to check deployment was successful
    expect(await lpTokenManager.lpTokenContract()).to.equal(lpTokenContract.target);
    expect(await lpTokenManager.relayer()).to.equal(addresses.relayer);
    expect(await lpTokenManager.lpWithdrawService()).to.equal(addresses.lpWithdrawService);
  });
}); 