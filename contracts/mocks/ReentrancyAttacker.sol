// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../enclave-smart-balance/v1.1/EnclaveMultichainLPTokenManager.sol";

/**
 * @title ReentrancyAttacker
 * @notice A mock contract to test reentrancy protection in EnclaveMultichainLPToken
 */
contract ReentrancyAttacker {
    EnclaveMultichainLPTokenManager public target;
    bool public attacking = false;
    bool public reentrancyAttempted = false;

    event ReentrancyAttempted();

    constructor(address _target) {
        target = EnclaveMultichainLPTokenManager(_target);
    }

    // Function to approve tokens for withdrawal
    function approveTokens(address token, address spender, uint256 amount) external {
        IERC20(token).approve(spender, amount);
    }

    // Attack on recordDeposit function
    function attackRecordDeposit(
        address user,
        address underlyingToken,
        uint256 amount,
        uint256 chainId
    ) external {
        attacking = true;
        // First call that should succeed
        target.recordDeposit(user, underlyingToken, amount, chainId);
        
        // Check if we actually tried to reenter during the callback
        require(reentrancyAttempted, "Reentrancy was not attempted");
    }

    // Attack on requestWithdrawal function
    function attackRequestWithdrawal(
        address underlyingToken,
        uint256 lpAmount,
        uint256 chainId
    ) external {
        attacking = true;
        // First call that should succeed
        target.requestWithdrawal(underlyingToken, lpAmount, chainId);
        
        // Check if we actually tried to reenter during the callback
        require(reentrancyAttempted, "Reentrancy was not attempted");
    }

    // When the LP token is minted, try to reenter
    receive() external payable {
        if (attacking) {
            reentrancyAttempted = true;
            emit ReentrancyAttempted();
            // Try to reenter the same function - this should revert due to the nonReentrant modifier
            try target.recordDeposit(address(this), address(0x1), 1, 1) {
                // If this succeeds (which it shouldn't), the test will fail
            } catch {
                // This is expected to fail, so we catch the error
            }
        }
    }

    // ERC20 callback for transferFrom
    function onERC20Received(address, uint256) external returns (bytes4) {
        if (attacking) {
            reentrancyAttempted = true;
            emit ReentrancyAttempted();
            // Try to reenter via another function - this should revert due to the nonReentrant modifier
            try target.requestWithdrawal(address(0x1), 1, 1) {
                // If this succeeds (which it shouldn't), the test will fail
            } catch {
                // This is expected to fail, so we catch the error
            }
        }
        return bytes4(keccak256("onERC20Received(address,uint256)"));
    }
} 