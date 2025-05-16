// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MaliciousBridgeMock
 * @notice Mock contract that rejects all native token transfers
 * @dev Used for testing failure scenarios
 */
contract MaliciousBridgeMock {
    // Always revert on receiving native tokens
    receive() external payable {
        revert("I reject all transfers");
    }
    
    fallback() external payable {
        revert("I reject all transfers");
    }
} 