import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("EnclaveMultichainLPToken", function () {
  let enclaveMultichainLPToken: Contract;
  let mockToken: Contract;
  let lpToken: Contract;
  let owner: any;
  let manager: any;
  let user1: any;
  let user2: any;
  
  let ownerAddress: string;
  let managerAddress: string;
  let user1Address: string;
  let user2Address: string;
  
  const CHAIN_ID_1 = 1n;
  const CHAIN_ID_2 = 2n;
  const DEPOSIT_AMOUNT = ethers.parseEther("100");
  const WITHDRAWAL_AMOUNT = ethers.parseEther("50");

  beforeEach(async function () {
    [owner, manager, user1, user2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    managerAddress = await manager.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();

    // Deploy the mock token
    const MockToken = await ethers.getContractFactory("contracts/mocks/MockUSDC.sol:MockUSDC");
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Deploy the EnclaveMultichainLPToken contract
    const EnclaveMultichainLPToken = await ethers.getContractFactory("EnclaveMultichainLPToken");
    enclaveMultichainLPToken = await EnclaveMultichainLPToken.deploy(managerAddress);
    await enclaveMultichainLPToken.waitForDeployment();
  });

  describe("Constructor", function () {
    it("should initialize with correct LP token manager", async function () {
      expect(await enclaveMultichainLPToken.lpTokenManager()).to.equal(managerAddress);
    });

    it("should revert when initialized with zero address", async function () {
      const EnclaveMultichainLPToken = await ethers.getContractFactory("EnclaveMultichainLPToken");
      await expect(EnclaveMultichainLPToken.deploy(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid LP token manager address");
    });
  });

  describe("setLPTokenManager", function () {
    it("should update LP token manager", async function () {
      await enclaveMultichainLPToken.connect(owner).setLPTokenManager(user1Address);
      expect(await enclaveMultichainLPToken.lpTokenManager()).to.equal(user1Address);
    });

    it("should emit ManagerUpdated event", async function () {
      await expect(enclaveMultichainLPToken.connect(owner).setLPTokenManager(user1Address))
        .to.emit(enclaveMultichainLPToken, "ManagerUpdated")
        .withArgs(managerAddress, user1Address);
    });

    it("should revert when called by non-owner", async function () {
      await expect(enclaveMultichainLPToken.connect(user1).setLPTokenManager(user1Address))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when setting zero address", async function () {
      await expect(enclaveMultichainLPToken.connect(owner).setLPTokenManager(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid manager address");
    });
  });

  describe("Chain Management", function () {
    it("should add supported chain", async function () {
      await enclaveMultichainLPToken.connect(manager).addSupportedChain(CHAIN_ID_1);
      expect(await enclaveMultichainLPToken.supportedChains(CHAIN_ID_1)).to.be.true;
    });

    it("should remove supported chain", async function () {
      await enclaveMultichainLPToken.connect(manager).addSupportedChain(CHAIN_ID_1);
      await enclaveMultichainLPToken.connect(manager).removeSupportedChain(CHAIN_ID_1);
      expect(await enclaveMultichainLPToken.supportedChains(CHAIN_ID_1)).to.be.false;
    });

    it("should revert addSupportedChain when called by non-manager", async function () {
      await expect(enclaveMultichainLPToken.connect(user1).addSupportedChain(CHAIN_ID_1))
        .to.be.revertedWith("Caller is not the LP token manager");
    });

    it("should revert addSupportedChain with invalid chain ID", async function () {
      await expect(enclaveMultichainLPToken.connect(manager).addSupportedChain(0))
        .to.be.revertedWith("Invalid chain ID");
    });

    it("should revert removeSupportedChain when called by non-manager", async function () {
      await expect(enclaveMultichainLPToken.connect(user1).removeSupportedChain(CHAIN_ID_1))
        .to.be.revertedWith("Caller is not the LP token manager");
    });
  });

  describe("LP Token Creation", function () {
    it("should create a new LP token", async function () {
      const tx = await enclaveMultichainLPToken.connect(manager).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      );
      const receipt = await tx.wait();
      
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === 'LPTokenCreated'
      );

      expect(event).to.not.be.undefined;
      
      const lpTokenAddress = await enclaveMultichainLPToken.lpTokens(mockToken.target);
      expect(lpTokenAddress).to.not.equal(ethers.ZeroAddress);

      // Initialize the LP token contract
      const EnclaveTokenLP = await ethers.getContractFactory("EnclaveTokenLP");
      lpToken = EnclaveTokenLP.attach(lpTokenAddress);

      // Verify the LP token properties
      expect(await lpToken.name()).to.equal("Enclave LP Token");
      expect(await lpToken.symbol()).to.equal("ELPT");
      expect(await lpToken.owner()).to.equal(enclaveMultichainLPToken.target);
    });

    it("should emit LPTokenCreated event", async function () {
      await expect(enclaveMultichainLPToken.connect(manager).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      )).to.emit(enclaveMultichainLPToken, "LPTokenCreated");
    });

    it("should revert when called by non-manager", async function () {
      await expect(enclaveMultichainLPToken.connect(user1).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      )).to.be.revertedWith("Caller is not the LP token manager");
    });

    it("should revert with invalid underlying token address", async function () {
      await expect(enclaveMultichainLPToken.connect(manager).createLPToken(
        ethers.ZeroAddress,
        "Enclave LP Token",
        "ELPT"
      )).to.be.revertedWith("Invalid underlying token address");
    });

    it("should revert when LP token already exists for the underlying token", async function () {
      await enclaveMultichainLPToken.connect(manager).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      );

      await expect(enclaveMultichainLPToken.connect(manager).createLPToken(
        mockToken.target,
        "Enclave LP Token 2",
        "ELPT2"
      )).to.be.revertedWith("LP token already exists for this underlying token");
    });
  });

  describe("Deposit and Withdrawal", function () {
    beforeEach(async function () {
      // Create LP token and add supported chains
      await enclaveMultichainLPToken.connect(manager).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      );
      
      await enclaveMultichainLPToken.connect(manager).addSupportedChain(CHAIN_ID_1);
      await enclaveMultichainLPToken.connect(manager).addSupportedChain(CHAIN_ID_2);
      
      // Get the LP token contract
      const lpTokenAddress = await enclaveMultichainLPToken.lpTokens(mockToken.target);
      const EnclaveTokenLP = await ethers.getContractFactory("EnclaveTokenLP");
      lpToken = EnclaveTokenLP.attach(lpTokenAddress);
    });

    describe("recordDeposit", function () {
      it("should record deposit and mint LP tokens", async function () {
        await enclaveMultichainLPToken.connect(manager).recordDeposit(
          user1Address,
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_1
        );

        // Check LP token balance - with simplified contract, the LP tokens are minted 1:1
        expect(await lpToken.balanceOf(user1Address)).to.equal(DEPOSIT_AMOUNT);
      });

      it("should emit TokensDeposited event", async function () {
        await expect(enclaveMultichainLPToken.connect(manager).recordDeposit(
          user1Address,
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_1
        )).to.emit(enclaveMultichainLPToken, "TokensDeposited")
          .withArgs(mockToken.target, DEPOSIT_AMOUNT, CHAIN_ID_1, user1Address);
      });

      it("should revert when called by non-manager", async function () {
        await expect(enclaveMultichainLPToken.connect(user1).recordDeposit(
          user1Address,
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_1
        )).to.be.revertedWith("Caller is not the LP token manager");
      });

      it("should revert with invalid user address", async function () {
        await expect(enclaveMultichainLPToken.connect(manager).recordDeposit(
          ethers.ZeroAddress,
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_1
        )).to.be.revertedWith("Invalid user address");
      });

      it("should revert with invalid token address", async function () {
        await expect(enclaveMultichainLPToken.connect(manager).recordDeposit(
          user1Address,
          ethers.ZeroAddress,
          DEPOSIT_AMOUNT,
          CHAIN_ID_1
        )).to.be.revertedWith("Invalid token address");
      });

      it("should revert with zero amount", async function () {
        await expect(enclaveMultichainLPToken.connect(manager).recordDeposit(
          user1Address,
          mockToken.target,
          0,
          CHAIN_ID_1
        )).to.be.revertedWith("Amount must be greater than 0");
      });

      it("should revert with unsupported chain ID", async function () {
        const UNSUPPORTED_CHAIN_ID = 999n;
        await expect(enclaveMultichainLPToken.connect(manager).recordDeposit(
          user1Address,
          mockToken.target,
          DEPOSIT_AMOUNT,
          UNSUPPORTED_CHAIN_ID
        )).to.be.revertedWith("Unsupported chain ID");
      });

      it("should revert when LP token not created", async function () {
        // Deploy a second mock token
        const MockToken2 = await ethers.getContractFactory("contracts/mocks/MockUSDC.sol:MockUSDC");
        const mockToken2 = await MockToken2.deploy("Mock Token 2", "MTK2");
        await mockToken2.waitForDeployment();
        
        await expect(enclaveMultichainLPToken.connect(manager).recordDeposit(
          user1Address,
          mockToken2.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_1
        )).to.be.revertedWith("LP token not created for this underlying token");
      });
    });

    describe("requestWithdrawal", function () {
      beforeEach(async function () {
        // Make an initial deposit
        await enclaveMultichainLPToken.connect(manager).recordDeposit(
          user1Address,
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_1
        );
        
        // Approve the LP tokens for withdrawal
        await lpToken.connect(user1).approve(enclaveMultichainLPToken.target, DEPOSIT_AMOUNT);
      });

      it("should burn LP tokens and emit WithdrawalRequested event", async function () {
        await expect(enclaveMultichainLPToken.connect(user1).requestWithdrawal(
          mockToken.target,
          WITHDRAWAL_AMOUNT,
          CHAIN_ID_1
        )).to.emit(enclaveMultichainLPToken, "WithdrawalRequested")
          .withArgs(mockToken.target, WITHDRAWAL_AMOUNT, user1Address, CHAIN_ID_1);
          
        // Check LP token balance
        expect(await lpToken.balanceOf(user1Address)).to.equal(DEPOSIT_AMOUNT - WITHDRAWAL_AMOUNT);
      });

      it("should handle a full withdrawal", async function () {
        await enclaveMultichainLPToken.connect(user1).requestWithdrawal(
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_1
        );
        
        // Check LP token balance
        expect(await lpToken.balanceOf(user1Address)).to.equal(0);
      });

      it("should revert with invalid token address", async function () {
        await expect(enclaveMultichainLPToken.connect(user1).requestWithdrawal(
          ethers.ZeroAddress,
          WITHDRAWAL_AMOUNT,
          CHAIN_ID_1
        )).to.be.revertedWith("Invalid token address");
      });

      it("should revert with zero amount", async function () {
        await expect(enclaveMultichainLPToken.connect(user1).requestWithdrawal(
          mockToken.target,
          0,
          CHAIN_ID_1
        )).to.be.revertedWith("Amount must be greater than 0");
      });

      it("should revert with unsupported chain ID", async function () {
        const UNSUPPORTED_CHAIN_ID = 999n;
        await expect(enclaveMultichainLPToken.connect(user1).requestWithdrawal(
          mockToken.target,
          WITHDRAWAL_AMOUNT,
          UNSUPPORTED_CHAIN_ID
        )).to.be.revertedWith("Unsupported chain ID");
      });

      it("should revert when LP token not created", async function () {
        // Deploy a second mock token
        const MockToken2 = await ethers.getContractFactory("contracts/mocks/MockUSDC.sol:MockUSDC");
        const mockToken2 = await MockToken2.deploy("Mock Token 2", "MTK2");
        await mockToken2.waitForDeployment();
        
        await expect(enclaveMultichainLPToken.connect(user1).requestWithdrawal(
          mockToken2.target,
          WITHDRAWAL_AMOUNT,
          CHAIN_ID_1
        )).to.be.revertedWith("LP token not created for this underlying token");
      });

      it("should revert when insufficient LP tokens", async function () {
        // Try to withdraw more than the balance
        await expect(enclaveMultichainLPToken.connect(user1).requestWithdrawal(
          mockToken.target,
          DEPOSIT_AMOUNT * 2n,
          CHAIN_ID_1
        )).to.be.reverted;
      });
    });
  });

  describe("EnclaveTokenLP", function () {
    let lpTokenAddress: string;
    
    beforeEach(async function () {
      // Create LP token
      await enclaveMultichainLPToken.connect(manager).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      );
      
      // Add supported chain for the minting test
      await enclaveMultichainLPToken.connect(manager).addSupportedChain(CHAIN_ID_1);
      
      lpTokenAddress = await enclaveMultichainLPToken.lpTokens(mockToken.target);
      const EnclaveTokenLP = await ethers.getContractFactory("EnclaveTokenLP");
      lpToken = EnclaveTokenLP.attach(lpTokenAddress);
    });

    it("should initialize with correct name and symbol", async function () {
      expect(await lpToken.name()).to.equal("Enclave LP Token");
      expect(await lpToken.symbol()).to.equal("ELPT");
    });

    it("should set LP manager as owner", async function () {
      expect(await lpToken.owner()).to.equal(enclaveMultichainLPToken.target);
    });

    it("should allow minting tokens by the owner", async function () {
      // The LP Token's owner is the LP Manager contract, so we need to call through the manager
      await enclaveMultichainLPToken.connect(manager).recordDeposit(
        user1Address,
        mockToken.target,
        DEPOSIT_AMOUNT,
        CHAIN_ID_1
      );
      
      expect(await lpToken.balanceOf(user1Address)).to.equal(DEPOSIT_AMOUNT);
    });

    it("should revert minting when called directly by non-owner", async function () {
      const EnclaveTokenLP = await ethers.getContractFactory("EnclaveTokenLP");
      
      // Try to call mint directly on the LP token contract
      await expect(EnclaveTokenLP.attach(lpTokenAddress).connect(user1).mint(
        user1Address,
        DEPOSIT_AMOUNT
      )).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert initialization with zero LP manager address", async function () {
      const EnclaveTokenLP = await ethers.getContractFactory("EnclaveTokenLP");
      
      await expect(EnclaveTokenLP.deploy(
        "Test LP Token",
        "TLPT",
        ethers.ZeroAddress
      )).to.be.revertedWith("Invalid LP manager address");
    });

    it("should test EnclaveTokenLP with different initialization values", async function () {
      // Deploy the LP token with different name and symbol directly
      const EnclaveTokenLP = await ethers.getContractFactory("EnclaveTokenLP");
      const directLpToken = await EnclaveTokenLP.deploy(
        "Direct LP Token",
        "DLPT",
        managerAddress
      );
      
      expect(await directLpToken.name()).to.equal("Direct LP Token");
      expect(await directLpToken.symbol()).to.equal("DLPT");
      expect(await directLpToken.lpManager()).to.equal(managerAddress);
      expect(await directLpToken.owner()).to.equal(managerAddress);
    });
  });
}); 