import { expect } from "chai";
import { ethers } from "hardhat";

describe("EnclaveMultichainLPTokenManager", function () {
  let enclaveMultichainLPTokenManager: any;
  let mockToken: any;
  let lpToken: any;
  
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
  const WITHDRAWAL_AMOUNT = ethers.parseEther("50");

  beforeEach(async function () {
    [owner, relayer, newRelayer, user1, user2] = await ethers.getSigners();
    
    ownerAddress = await owner.getAddress();
    relayerAddress = await relayer.getAddress();
    newRelayerAddress = await newRelayer.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();

    // Deploy the mock token
    const MockToken = await ethers.getContractFactory("contracts/mocks/MockUSDC.sol:MockUSDC");
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Deploy the EnclaveMultichainLPTokenManager contract
    const EnclaveMultichainLPTokenManager = await ethers.getContractFactory("EnclaveMultichainLPTokenManager");
    enclaveMultichainLPTokenManager = await EnclaveMultichainLPTokenManager.deploy(relayerAddress);
    await enclaveMultichainLPTokenManager.waitForDeployment();

    // Set supported chains
    await enclaveMultichainLPTokenManager.connect(owner).addSupportedChain(CHAIN_ID_ETH);
    await enclaveMultichainLPTokenManager.connect(owner).addSupportedChain(CHAIN_ID_POLYGON);
  });

  describe("Constructor", function () {
    it("should initialize with correct relayer", async function () {
      expect(await enclaveMultichainLPTokenManager.relayer()).to.equal(relayerAddress);
    });

    it("should revert when initialized with zero relayer address", async function () {
      const EnclaveMultichainLPTokenManager = await ethers.getContractFactory("EnclaveMultichainLPTokenManager");
      await expect(EnclaveMultichainLPTokenManager.deploy(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid relayer address");
    });
  });

  describe("setRelayer", function () {
    it("should update relayer address", async function () {
      await enclaveMultichainLPTokenManager.connect(owner).setRelayer(newRelayerAddress);
      expect(await enclaveMultichainLPTokenManager.relayer()).to.equal(newRelayerAddress);
    });

    it("should emit RelayerUpdated event", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(owner).setRelayer(newRelayerAddress))
        .to.emit(enclaveMultichainLPTokenManager, "RelayerUpdated")
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

  describe("Chain Management", function () {
    it("should add supported chain", async function () {
      const NEW_CHAIN_ID = 56n; // BSC
      await enclaveMultichainLPTokenManager.connect(owner).addSupportedChain(NEW_CHAIN_ID);
      expect(await enclaveMultichainLPTokenManager.supportedChains(NEW_CHAIN_ID)).to.be.true;
    });

    it("should remove supported chain", async function () {
      await enclaveMultichainLPTokenManager.connect(owner).removeSupportedChain(CHAIN_ID_ETH);
      expect(await enclaveMultichainLPTokenManager.supportedChains(CHAIN_ID_ETH)).to.be.false;
    });

    it("should revert addSupportedChain when called by non-owner", async function () {
      const NEW_CHAIN_ID = 56n; // BSC
      await expect(enclaveMultichainLPTokenManager.connect(user1).addSupportedChain(NEW_CHAIN_ID))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert addSupportedChain with invalid chain ID", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(owner).addSupportedChain(0))
        .to.be.revertedWith("Invalid chain ID");
    });

    it("should revert removeSupportedChain when called by non-owner", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(user1).removeSupportedChain(CHAIN_ID_ETH))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("LP Token Creation", function () {
    it("should create a new LP token", async function () {
      const tx = await enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      );
      const receipt = await tx.wait();
      
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === 'LPTokenCreated'
      );

      expect(event).to.not.be.undefined;
      
      const lpTokenAddress = await enclaveMultichainLPTokenManager.lpTokens(mockToken.target);
      expect(lpTokenAddress).to.not.equal(ethers.ZeroAddress);

      // Initialize the LP token contract
      const EnclaveTokenLP = await ethers.getContractFactory("EnclaveTokenLP");
      lpToken = EnclaveTokenLP.attach(lpTokenAddress);

      // Verify the LP token properties
      expect(await lpToken.name()).to.equal("Enclave LP Token");
      expect(await lpToken.symbol()).to.equal("ELPT");
      expect(await lpToken.owner()).to.equal(enclaveMultichainLPTokenManager.target);
    });

    it("should emit LPTokenCreated event", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      )).to.emit(enclaveMultichainLPTokenManager, "LPTokenCreated");
    });

    it("should revert when called by non-owner", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(user1).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      )).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert with invalid underlying token address", async function () {
      await expect(enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        ethers.ZeroAddress,
        "Enclave LP Token",
        "ELPT"
      )).to.be.revertedWith("Invalid underlying token address");
    });

    it("should revert when LP token already exists for the underlying token", async function () {
      await enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      );

      await expect(enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "Enclave LP Token 2",
        "ELPT2"
      )).to.be.revertedWith("LP token already exists for this underlying token");
    });
  });

  describe("Deposit and Withdrawal", function () {
    beforeEach(async function () {
      // Create LP token and add supported chains
      await enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      );
      
      // Get the LP token contract
      const lpTokenAddress = await enclaveMultichainLPTokenManager.lpTokens(mockToken.target);
      const EnclaveTokenLP = await ethers.getContractFactory("EnclaveTokenLP");
      lpToken = EnclaveTokenLP.attach(lpTokenAddress);
    });

    describe("recordDeposit", function () {
      it("should record deposit and mint LP tokens", async function () {
        await enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
          user1Address,
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_ETH
        );

        // Check LP token balance - with simplified contract, the LP tokens are minted 1:1
        expect(await lpToken.balanceOf(user1Address)).to.equal(DEPOSIT_AMOUNT);
      });

      it("should emit TokensDeposited event", async function () {
        await expect(enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
          user1Address,
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_ETH
        )).to.emit(enclaveMultichainLPTokenManager, "TokensDeposited")
          .withArgs(mockToken.target, DEPOSIT_AMOUNT, CHAIN_ID_ETH, user1Address);
      });

      it("should revert when called by non-relayer", async function () {
        await expect(enclaveMultichainLPTokenManager.connect(user1).recordDeposit(
          user1Address,
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_ETH
        )).to.be.revertedWith("Caller is not the relayer");
      });

      it("should revert with invalid user address", async function () {
        await expect(enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
          ethers.ZeroAddress,
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_ETH
        )).to.be.revertedWith("Invalid user address");
      });

      it("should revert with invalid token address", async function () {
        await expect(enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
          user1Address,
          ethers.ZeroAddress,
          DEPOSIT_AMOUNT,
          CHAIN_ID_ETH
        )).to.be.revertedWith("Invalid token address");
      });

      it("should revert with zero amount", async function () {
        await expect(enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
          user1Address,
          mockToken.target,
          0,
          CHAIN_ID_ETH
        )).to.be.revertedWith("Amount must be greater than 0");
      });

      it("should revert with unsupported chain ID", async function () {
        const UNSUPPORTED_CHAIN_ID = 999n;
        await expect(enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
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
        
        await expect(enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
          user1Address,
          mockToken2.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_ETH
        )).to.be.revertedWith("LP token not created for this underlying token");
      });
    });

    describe("requestWithdrawal", function () {
      beforeEach(async function () {
        // Make an initial deposit
        await enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
          user1Address,
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_ETH
        );
        
        // Approve the LP tokens for withdrawal
        await lpToken.connect(user1).approve(enclaveMultichainLPTokenManager.target, DEPOSIT_AMOUNT);
      });

      it("should burn LP tokens and emit WithdrawalRequested event", async function () {
        await expect(enclaveMultichainLPTokenManager.connect(user1).requestWithdrawal(
          mockToken.target,
          WITHDRAWAL_AMOUNT,
          CHAIN_ID_ETH
        )).to.emit(enclaveMultichainLPTokenManager, "WithdrawalRequested")
          .withArgs(mockToken.target, WITHDRAWAL_AMOUNT, user1Address, CHAIN_ID_ETH);
          
        // Check LP token balance
        expect(await lpToken.balanceOf(user1Address)).to.equal(DEPOSIT_AMOUNT - WITHDRAWAL_AMOUNT);
      });

      it("should handle a full withdrawal", async function () {
        await enclaveMultichainLPTokenManager.connect(user1).requestWithdrawal(
          mockToken.target,
          DEPOSIT_AMOUNT,
          CHAIN_ID_ETH
        );
        
        // Check LP token balance
        expect(await lpToken.balanceOf(user1Address)).to.equal(0);
      });

      it("should revert with invalid token address", async function () {
        await expect(enclaveMultichainLPTokenManager.connect(user1).requestWithdrawal(
          ethers.ZeroAddress,
          WITHDRAWAL_AMOUNT,
          CHAIN_ID_ETH
        )).to.be.revertedWith("Invalid token address");
      });

      it("should revert with zero amount", async function () {
        await expect(enclaveMultichainLPTokenManager.connect(user1).requestWithdrawal(
          mockToken.target,
          0,
          CHAIN_ID_ETH
        )).to.be.revertedWith("Amount must be greater than 0");
      });

      it("should revert with unsupported chain ID", async function () {
        const UNSUPPORTED_CHAIN_ID = 999n;
        await expect(enclaveMultichainLPTokenManager.connect(user1).requestWithdrawal(
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
        
        await expect(enclaveMultichainLPTokenManager.connect(user1).requestWithdrawal(
          mockToken2.target,
          WITHDRAWAL_AMOUNT,
          CHAIN_ID_ETH
        )).to.be.revertedWith("LP token not created for this underlying token");
      });

      it("should revert when insufficient LP tokens", async function () {
        // Try to withdraw more than the balance
        await expect(enclaveMultichainLPTokenManager.connect(user1).requestWithdrawal(
          mockToken.target,
          DEPOSIT_AMOUNT * 2n,
          CHAIN_ID_ETH
        )).to.be.reverted;
      });
    });
  });

  describe("EnclaveTokenLP", function () {
    let lpTokenAddress: string;
    
    beforeEach(async function () {
      // Create LP token
      await enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      );
      
      lpTokenAddress = await enclaveMultichainLPTokenManager.lpTokens(mockToken.target);
      const EnclaveTokenLP = await ethers.getContractFactory("EnclaveTokenLP");
      lpToken = EnclaveTokenLP.attach(lpTokenAddress);
    });

    it("should initialize with correct name and symbol", async function () {
      expect(await lpToken.name()).to.equal("Enclave LP Token");
      expect(await lpToken.symbol()).to.equal("ELPT");
    });

    it("should set LP manager as owner", async function () {
      expect(await lpToken.owner()).to.equal(enclaveMultichainLPTokenManager.target);
    });

    it("should allow minting tokens by the owner", async function () {
      // The LP Token's owner is the LP Manager contract, so we need to call through the manager
      await enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
        user1Address,
        mockToken.target,
        DEPOSIT_AMOUNT,
        CHAIN_ID_ETH
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
  });

  // Edge cases and boundary conditions
  describe("Edge cases and boundary conditions", function () {
    beforeEach(async function () {
      // Create LP token
      await enclaveMultichainLPTokenManager.connect(owner).createLPToken(
        mockToken.target,
        "Enclave LP Token",
        "ELPT"
      );
    });

    it("should handle extremely large deposit amounts", async function () {
      const VERY_LARGE_AMOUNT = ethers.parseEther("1000000000"); // 1 billion ETH
      
      // Get the LP token address
      const lpTokenAddress = await enclaveMultichainLPTokenManager.lpTokens(mockToken.target);
      
      // Create LP token contract instance
      const lpToken = await ethers.getContractAt("EnclaveTokenLP", lpTokenAddress);
      
      // Then relay deposit with very large amount
      await enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
        user1Address,
        mockToken.target,
        VERY_LARGE_AMOUNT,
        CHAIN_ID_ETH
      );
      
      // Check LP tokens were minted correctly with the large amount (1:1 ratio)
      expect(await lpToken.balanceOf(user1Address)).to.equal(VERY_LARGE_AMOUNT);
    });

    it("should handle small, non-zero deposit amounts", async function () {
      const VERY_SMALL_AMOUNT = 1n; // Smallest possible amount
      
      // Get the LP token address
      const lpTokenAddress = await enclaveMultichainLPTokenManager.lpTokens(mockToken.target);
      
      // Create LP token contract instance
      const lpToken = await ethers.getContractAt("EnclaveTokenLP", lpTokenAddress);
      
      // Then relay deposit with very small amount
      await enclaveMultichainLPTokenManager.connect(relayer).recordDeposit(
        user1Address,
        mockToken.target,
        VERY_SMALL_AMOUNT,
        CHAIN_ID_ETH
      );
      
      // Check LP tokens were minted correctly with the small amount (1:1 ratio)
      expect(await lpToken.balanceOf(user1Address)).to.equal(VERY_SMALL_AMOUNT);
    });

    it("should handle updating relayer with same address", async function () {
      // Try to set the same relayer address
      const tx = enclaveMultichainLPTokenManager.connect(owner).setRelayer(relayerAddress);
      
      // Check the transaction completes successfully (no revert)
      await expect(tx).to.not.be.reverted;
    });
  });
}); 