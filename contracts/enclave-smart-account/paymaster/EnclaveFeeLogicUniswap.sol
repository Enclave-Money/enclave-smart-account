// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./CustomFullMath.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "./IEnclaveFeeLogic.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";

struct PoolInfo {
    address poolAddress;
    uint24 fee;
    uint128 liquidity;
}

contract EnclaveFeeLogicUniswap is IEnclaveFeeLogic, Ownable {
    using SafeMath for uint256;

    address public immutable WETH9;
    IUniswapV3Factory public immutable factory;
    uint24 public markup;
    uint24 public markupDenominator;
    uint24[] public feeTiers;
    uint256 private constant Q96 = 2**96;

    constructor(address _WETH9, address _factory, uint24 _markup, uint24 _markupDenominator) {
        WETH9 = _WETH9;
        factory = IUniswapV3Factory(_factory);
        markup = _markup;
        markupDenominator = _markupDenominator;
        feeTiers = [100, 500, 3000, 10000];
    }

    function updateFeeTiers(uint24[] memory _feeTiers) external onlyOwner {
        feeTiers = _feeTiers;
    }

    function updateMarkup(uint24 _markup) external onlyOwner {
        markup = _markup;
    }

    function updateMarkupDenominator(uint24 _markupDenominator) external onlyOwner {
        markupDenominator = _markupDenominator;
    }

    function calculateFee(address token, uint256 gasUsed) external view returns (uint256) {
        uint256 baseFeeInEth = CustomFullMath.mulDiv(gasUsed, tx.gasprice, 1);

        if (token == WETH9) {
            return baseFeeInEth;
        }

        uint256 amountIn = getAmountIn(token, baseFeeInEth);
        return CustomFullMath.mulDiv(amountIn, markup, 100);
    }

    function findOptimalPool(address token) public view returns (uint24) {
        PoolInfo memory bestPool;
        uint128 bestLiquidity = 0;

        for (uint i = 0; i < feeTiers.length; i++) {
            address poolAddress = factory.getPool(WETH9, token, feeTiers[i]);
            
            if (poolAddress != address(0)) {
                IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
                uint128 liquidity = pool.liquidity();
                
                if (liquidity > bestLiquidity || (liquidity == bestLiquidity && feeTiers[i] < bestPool.fee)) {
                    bestPool.poolAddress = poolAddress;
                    bestPool.fee = feeTiers[i];
                    bestPool.liquidity = liquidity;
                    bestLiquidity = liquidity;
                }
            }
        }

        return bestPool.fee;
    }

    function getAmountIn(address tokenIn, uint256 amountOut) internal view returns (uint256 amountIn) {
        // PoolInfo memory poolInfo = findOptimalPool(tokenIn);
        uint24 fee = findOptimalPool(tokenIn);
        address poolAddress = factory.getPool(tokenIn, WETH9, fee);

        require(poolAddress != address(0), "Pool does not exist");
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        uint256 priceX96 = CustomFullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), Q96);

        // Calculate the price after the swap
        uint256 ethAmountWithFee = CustomFullMath.mulDiv(amountOut, 1000, uint256(1000).sub(uint256(fee).div(1000))); // Apply fee
        uint256 newPriceX96 = priceX96.add(CustomFullMath.mulDiv(ethAmountWithFee, Q96, pool.liquidity()));

        amountIn = CustomFullMath.mulDiv(amountOut, newPriceX96, Q96);
        
        // Adjust for decimals
        amountIn = CustomFullMath.mulDiv(amountIn, 10**ERC20(tokenIn).decimals(), 10**18);
        
        // Add some slippage tolerance (e.g., 1%)
        amountIn = CustomFullMath.mulDiv(amountIn, markup, markupDenominator);
    }
}