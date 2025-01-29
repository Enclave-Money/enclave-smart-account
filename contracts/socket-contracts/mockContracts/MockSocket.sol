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
    function outbound(
        uint32 remoteChainSlug_,
        uint256 minMsgGasLimit_,
        bytes32 executionParams_,
        bytes32 transmissionParams_,
        bytes calldata payload_
    ) external payable returns (bytes32 msgId) {
        console.log("Calling Outbound: ", remoteChainSlug_);
        
        return bytes32(uint256(1));
    }

    function getMinFees(
        uint256 minMsgGasLimit_,
        uint256 payloadSize_,
        bytes32 executionParams_,
        bytes32 transmissionParams_,
        uint32 remoteChainSlug_,
        address plug_
    ) external pure returns (uint256) {
        // Mock implementation - return 0 fees
        return 0;
    }
}