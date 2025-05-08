// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title NonPayableRecipient
 * @notice A mock contract that intentionally rejects ETH transfers for testing
 */
contract NonPayableRecipient {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    // Explicitly disable receiving ETH
    receive() external payable {
        revert("Cannot receive ETH");
    }
    
    fallback() external payable {
        revert("Cannot receive ETH");
    }
    
    function getAddress() external view returns (address) {
        return address(this);
    }
} 