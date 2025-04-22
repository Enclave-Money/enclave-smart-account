import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseContract } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("EnclaveVerifyingTokenPaymaster", function () {
  // Contracts
  let entryPoint: any;
  let paymentToken: any;
  let wrappedNative: any;
  let tokenPaymaster: any;
  let uniswapRouter: any;
  let feeLogic: any;
  let mockPool: any;
  let mockFactory: any;

  // Signers
  let owner: any;
  let verifyingSigner: any;
  let user: any;
  let beneficiary: any;
  
  // Addresses
  let ownerAddress: string;
  let verifyingSignerAddress: string;
  let userAddress: string;
  let beneficiaryAddress: string;
  
  // Constants
  const DAY_IN_SECONDS = 86400;
  const HOUR_IN_SECONDS = 3600;
  const CHAIN_ID = 31337; // Hardhat's chain ID

  beforeEach(async function () {
    // Get signers
    [owner, user, beneficiary] = await ethers.getSigners();
    
    // Create a random wallet for the verifying signer
    const randomWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    verifyingSigner = randomWallet;
    
    // Store addresses
    ownerAddress = await owner.getAddress();
    verifyingSignerAddress = await verifyingSigner.getAddress();
    userAddress = await user.getAddress();
    beneficiaryAddress = await beneficiary.getAddress();

    // Send ETH to the verifying signer for gas
    await owner.sendTransaction({
      to: verifyingSignerAddress,
      value: ethers.parseEther("1")
    });

    // Deploy mock contracts
    const EntryPoint = await ethers.getContractFactory("MockEntryPoint");
    entryPoint = await EntryPoint.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("TestToken", "TT");

    const MockWETH = await ethers.getContractFactory("MockWETH");
    wrappedNative = await MockWETH.deploy();

    // Deploy mock Uniswap infrastructure
    const MockFactory = await ethers.getContractFactory("MockUniswapV3Factory");
    mockFactory = await MockFactory.deploy();
    
    const MockPool = await ethers.getContractFactory("MockUniswapV3Pool");
    mockPool = await MockPool.deploy();
    
    const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    uniswapRouter = await MockSwapRouter.deploy(await wrappedNative.getAddress());
    
    // Set up the pool for token swaps
    await mockFactory.setPool(await mockPool.getAddress());
    await mockPool.setTokens(await paymentToken.getAddress(), await wrappedNative.getAddress());
    const sqrtPriceX96 = ethers.parseUnits("1", 18);
    await mockPool.setSqrtPriceX96(sqrtPriceX96);
    await mockPool.setLiquidity(ethers.parseUnits("1000000", 18));

    // Deploy fee logic contract
    const MockEnclaveFeeLogic = await ethers.getContractFactory("MockEnclaveFeeLogic");
    feeLogic = await MockEnclaveFeeLogic.deploy();

    // Deploy the paymaster
    const TokenPaymaster = await ethers.getContractFactory("EnclaveVerifyingTokenPaymaster");
    tokenPaymaster = await TokenPaymaster.deploy(
      await entryPoint.getAddress(),
      verifyingSignerAddress,
      await paymentToken.getAddress(),
      await feeLogic.getAddress(),
      await wrappedNative.getAddress(),
      await uniswapRouter.getAddress()
    );

    // Fund accounts
    await paymentToken.mint(userAddress, ethers.parseEther("1000"));
    await wrappedNative.deposit({ value: ethers.parseEther("10") });
    await wrappedNative.transfer(await uniswapRouter.getAddress(), ethers.parseEther("10"));

    // Add stake to paymaster
    await tokenPaymaster.addStake(100, { value: ethers.parseEther("1") });

    // Approve paymaster to spend user tokens
    await paymentToken.connect(user).approve(await tokenPaymaster.getAddress(), ethers.MaxUint256);
  });

  describe("Basic tests", function () {
    it("should initialize with the correct parameters", async function () {
      expect(await tokenPaymaster.entryPoint()).to.equal(await entryPoint.getAddress());
      expect(await tokenPaymaster.verifyingSigner()).to.equal(verifyingSignerAddress);
      expect(await tokenPaymaster.paymentToken()).to.equal(await paymentToken.getAddress());
      expect(await tokenPaymaster.feeLogic()).to.equal(await feeLogic.getAddress());
    });

    it("should allow owner to update fee logic", async function() {
      const newFeeLogic = await (await ethers.getContractFactory("MockEnclaveFeeLogic")).deploy();
      await tokenPaymaster.updateFeeLogic(await newFeeLogic.getAddress());
      expect(await tokenPaymaster.feeLogic()).to.equal(await newFeeLogic.getAddress());
    });

    it("should allow owner to update payment token", async function() {
      const newToken = await (await ethers.getContractFactory("MockERC20")).deploy("NewToken", "NT");
      await tokenPaymaster.updatePaymentToken(await newToken.getAddress());
      expect(await tokenPaymaster.paymentToken()).to.equal(await newToken.getAddress());
    });

    it("should allow owner to update verifying signer", async function() {
      const newSigner = ethers.Wallet.createRandom().connect(ethers.provider);
      
      // Fund the new signer to allow for transactions
      await owner.sendTransaction({
        to: await newSigner.getAddress(),
        value: ethers.parseEther("1")
      });
      
      // Set the new signer
      await tokenPaymaster.connect(owner).updateVerifyingSigner(await newSigner.getAddress());
      
      // Verify it was updated
      expect(await tokenPaymaster.verifyingSigner()).to.equal(await newSigner.getAddress());
      
      // Verify that the new signer can perform actions
      await paymentToken.mint(await tokenPaymaster.getAddress(), ethers.parseEther("10"));
      await tokenPaymaster.connect(newSigner).withdrawToken(
        await paymentToken.getAddress(),
        await newSigner.getAddress(),
        ethers.parseEther("1")
      );
    });
    
    it("should prevent non-owner from updating verifying signer", async function() {
      const randomWallet = ethers.Wallet.createRandom().connect(ethers.provider);
      
      await expect(
        tokenPaymaster.connect(user).updateVerifyingSigner(randomWallet.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow verifying signer to withdraw tokens", async function() {
      // Fund the paymaster with tokens
      await paymentToken.mint(await tokenPaymaster.getAddress(), ethers.parseEther("10"));
      
      const amount = ethers.parseEther("5");
      const initialBalance = await paymentToken.balanceOf(verifyingSignerAddress);
      
      await tokenPaymaster.connect(verifyingSigner).withdrawToken(await paymentToken.getAddress(), verifyingSignerAddress, amount);
      
      const finalBalance = await paymentToken.balanceOf(verifyingSignerAddress);
      expect(finalBalance - initialBalance).to.equal(amount);
    });
  });

  describe("Token swapping", function () {
    it("should test ETH withdrawal", async function() {
      // Send some ETH to the paymaster
      await owner.sendTransaction({
        to: await tokenPaymaster.getAddress(),
        value: ethers.parseEther("1")
      });
      
      const initialBalance = await ethers.provider.getBalance(verifyingSignerAddress);
      const withdrawAmount = ethers.parseEther("0.5");
      
      await tokenPaymaster.connect(verifyingSigner).withdrawETH(verifyingSignerAddress, withdrawAmount);
      
      const finalBalance = await ethers.provider.getBalance(verifyingSignerAddress);
      // Account for gas costs by checking if the difference is close enough
      expect(finalBalance > initialBalance).to.be.true;
    });
    
    it("should swap tokens to ETH when called by verifying signer", async function() {
      // Fund paymaster with tokens to swap
      const swapAmount = ethers.parseEther("5");
      await paymentToken.mint(await tokenPaymaster.getAddress(), swapAmount);
      
      // Initial ETH balance of the contract
      const initialEthBalance = await ethers.provider.getBalance(await tokenPaymaster.getAddress());
      
      // Calculate min expected output (95% of swap amount as per default slippage)
      const minExpectedOutput = ethers.parseEther("4.75"); // 5 ETH - 5% slippage
      
      // Use the verifying signer to perform the swap
      await tokenPaymaster.connect(verifyingSigner).swapTokenForETH(
        swapAmount, 
        50, // 5.0% slippage
        minExpectedOutput
      );
      
      // Final ETH balance of the contract
      const finalEthBalance = await ethers.provider.getBalance(await tokenPaymaster.getAddress());
      
      // Should have more ETH after the swap
      expect(finalEthBalance > initialEthBalance).to.be.true;
    });
    
    it("should revert when owner tries to call swapTokenForETH", async function() {
      // Fund paymaster with tokens to swap
      const swapAmount = ethers.parseEther("5");
      await paymentToken.mint(await tokenPaymaster.getAddress(), swapAmount);
      
      // Calculate min expected output (95% of swap amount as per default slippage)
      const minExpectedOutput = ethers.parseEther("4.75"); // 5 ETH - 5% slippage
      
      // Should revert when owner tries to call swapTokenForETH
      await expect(
        tokenPaymaster.connect(owner).swapTokenForETH(
          swapAmount, 
          50, // 5.0% slippage
          minExpectedOutput
        )
      ).to.be.revertedWith("Only verifying signer can withdraw");
    });
    
    it("should validate swap parameters", async function() {
      // Fund paymaster with tokens to swap
      const swapAmount = ethers.parseEther("5");
      await paymentToken.mint(await tokenPaymaster.getAddress(), swapAmount);
      
      // Calculate min expected output
      const minExpectedOutput = ethers.parseEther("4.75"); // 5 ETH - 5% slippage
      
      // Should revert if amount is zero
      await expect(
        tokenPaymaster.connect(verifyingSigner).swapTokenForETH(
          0, 
          50,
          minExpectedOutput
        )
      ).to.be.revertedWith("Amount must be greater than 0");
      
      // Should revert if slippage is too high
      await expect(
        tokenPaymaster.connect(verifyingSigner).swapTokenForETH(
          swapAmount, 
          101, // 10.1% slippage
          minExpectedOutput
        )
      ).to.be.revertedWith("Slippage too high");
      
      // Should revert if minExpectedOutput is zero
      await expect(
        tokenPaymaster.connect(verifyingSigner).swapTokenForETH(
          swapAmount, 
          50,
          0
        )
      ).to.be.revertedWith("Minimum expected output must be greater than 0");
    });
  });

  describe("Contract deployment", function() {
    it("should deploy with the correct constructor parameters", async function() {
      const TokenPaymaster = await ethers.getContractFactory("EnclaveVerifyingTokenPaymaster");
      
      const newPaymaster = await TokenPaymaster.deploy(
        await entryPoint.getAddress(),
        verifyingSignerAddress,
        await paymentToken.getAddress(),
        await feeLogic.getAddress(),
        await wrappedNative.getAddress(),
        await uniswapRouter.getAddress()
      );
      
      await newPaymaster.waitForDeployment();
      
      expect(await newPaymaster.entryPoint()).to.equal(await entryPoint.getAddress());
      expect(await newPaymaster.verifyingSigner()).to.equal(verifyingSignerAddress);
      expect(await newPaymaster.paymentToken()).to.equal(await paymentToken.getAddress());
      expect(await newPaymaster.feeLogic()).to.equal(await feeLogic.getAddress());
    });
  });
  
  describe("Security and validation", function() {
    it("should validate token withdrawal parameters", async function() {
      // Fund the paymaster with tokens
      await paymentToken.mint(await tokenPaymaster.getAddress(), ethers.parseEther("10"));
      
      // Should revert if recipient is zero address
      await expect(
        tokenPaymaster.connect(verifyingSigner).withdrawToken(
          await paymentToken.getAddress(),
          ethers.ZeroAddress,
          ethers.parseEther("1")
        )
      ).to.be.revertedWith("Cannot withdraw to zero address");
      
      // Should revert if token address is zero
      await expect(
        tokenPaymaster.connect(verifyingSigner).withdrawToken(
          ethers.ZeroAddress,
          verifyingSignerAddress,
          ethers.parseEther("1")
        )
      ).to.be.revertedWith("Invalid token address");
      
      // Should revert if amount is zero
      await expect(
        tokenPaymaster.connect(verifyingSigner).withdrawToken(
          await paymentToken.getAddress(),
          verifyingSignerAddress,
          0
        )
      ).to.be.revertedWith("Amount must be greater than 0");
      
      // Should revert if amount exceeds balance
      await expect(
        tokenPaymaster.connect(verifyingSigner).withdrawToken(
          await paymentToken.getAddress(),
          verifyingSignerAddress,
          ethers.parseEther("11") // More than available
        )
      ).to.be.revertedWith("Insufficient token balance");
    });
    
    it("should validate ETH withdrawal parameters", async function() {
      // Send some ETH to the paymaster
      await owner.sendTransaction({
        to: await tokenPaymaster.getAddress(),
        value: ethers.parseEther("1")
      });
      
      // Should revert if recipient is zero address
      await expect(
        tokenPaymaster.connect(verifyingSigner).withdrawETH(
          ethers.ZeroAddress,
          ethers.parseEther("0.5")
        )
      ).to.be.revertedWith("Cannot withdraw to zero address");
      
      // Should revert if amount is zero
      await expect(
        tokenPaymaster.connect(verifyingSigner).withdrawETH(
          verifyingSignerAddress,
          0
        )
      ).to.be.revertedWith("Amount must be greater than 0");
      
      // Should revert if amount exceeds balance
      await expect(
        tokenPaymaster.connect(verifyingSigner).withdrawETH(
          verifyingSignerAddress,
          ethers.parseEther("2") // More than available
        )
      ).to.be.revertedWith("Insufficient ETH balance");
    });
  });
});
