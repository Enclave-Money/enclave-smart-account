import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("EnclaveFeeLogicUniswap", function () {
  let enclaveFeeLogic: Contract;
  let owner: Signer;
  let mockWETH: Contract;
  let mockFactory: Contract;
  let mockPool: Contract;

  const poolFee = 3000; // 0.3%

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Deploy mock contracts
    mockWETH = await (await ethers.getContractFactory("MockWETH")).deploy();
    mockFactory = await (await ethers.getContractFactory("MockUniswapV3Factory")).deploy();
    mockPool = await (await ethers.getContractFactory("MockUniswapV3Pool")).deploy();

    // Deploy EnclaveFeeLogicUniswap
    const EnclaveFeeLogicUniswap = await ethers.getContractFactory("EnclaveFeeLogicUniswap");
    enclaveFeeLogic = await EnclaveFeeLogicUniswap.deploy(mockWETH.address, mockFactory.address, poolFee);

    // Setup mock factory to return mock pool
    await mockFactory.setPool(mockPool.address);
  });

  it("should calculate fee correctly for WETH", async function () {
    const gasUsed = BigInt(100000);
    const gasPrice = ethers.parseUnits("20", "gwei");
    await ethers.provider.send("hardhat_setNextBlockBaseFeePerGas", [gasPrice.toString()]);

    const fee = await enclaveFeeLogic.calculateFee(mockWETH.address, gasUsed);
    expect(fee).to.equal(gasUsed * gasPrice);
  });

  it("should calculate fee correctly for other tokens", async function () {
    const gasUsed = BigInt(100000);
    const gasPrice = ethers.parseUnits("20", "gwei");
    await ethers.provider.send("hardhat_setNextBlockBaseFeePerGas", [gasPrice.toString()]);

    const mockToken = await (await ethers.getContractFactory("MockERC20")).deploy();
    const sqrtPriceX96 = ethers.parseUnits("1", 18); // 1:1 price ratio
    await mockPool.setSqrtPriceX96(sqrtPriceX96);

    const fee = await enclaveFeeLogic.calculateFee(mockToken.address, gasUsed);
    const expectedFee = (gasUsed * gasPrice * 105n) / 100n;
    expect(fee).to.equal(expectedFee);
  });
});