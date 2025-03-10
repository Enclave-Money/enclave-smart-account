// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IPlug.sol";

import "hardhat/console.sol";

contract MockSocket {
    // Function to simulate inbound messages from other chains
    function mockInbound(address target, bytes calldata packet) external {
        console.log("Target: ", target);
        IPlug(target).inbound(packet);
    }

    // Mock implementation of ISocket's callAppGateway function
    function callAppGateway(
        bytes calldata payload_,
        bytes32 params_
    ) external returns (bytes32 callId) {
        console.log("Calling AppGateway");
        return bytes32(uint256(1));
    }

    // Mock implementation of connect function
    function connect(address appGateway_, address switchboard_) external {
        console.log("Connecting to appGateway: ", appGateway_);
        console.log("Using switchboard: ", switchboard_);
    }

    // Mock implementation of execute function
    function execute(
        bytes32 payloadId_,
        address appGateway_,
        address target_,
        uint256 executionGasLimit_,
        bytes memory transmitterSignature_,
        bytes memory payload_
    ) external payable returns (bytes memory) {
        console.log("Executing payload: ", uint256(payloadId_));
        return "";
    }

    // Mock implementation of getPlugConfig
    function getPlugConfig(
        address plugAddress_
    ) external view returns (address appGateway, address switchboard) {
        return (address(0), address(0));
    }

    // Mock implementation of registerSwitchboard
    function registerSwitchboard() external {
        console.log("Registering switchboard");
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