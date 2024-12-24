// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IPlug.sol";
import "hardhat/console.sol";

contract MockSocket {
    // Function to simulate inbound messages from other chains
    function mockInbound(address target, uint32 chainId, bytes calldata packet) external {
        console.log("Target: ", target);
        console.log("ChainId: ", chainId);
        IPlug(target).inbound(chainId, packet);
    }

    // Add more mock functions as needed for testing outbound messages, etc.
    function outbound(uint256 chainId, bytes calldata packet) external returns (uint256) {
        // Mock implementation - return a dummy message ID
        return 1;
    }
}