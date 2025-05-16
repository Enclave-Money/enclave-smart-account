// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MockBridge
 * @notice Mock contract for testing bridge interactions in the VaultRebalancerManager
 */
contract MockBridge {
    bool public bridgeSuccess = true;
    uint256 public callCount = 0;
    bytes public lastBridgeData;
    
    /**
     * @notice Sets whether bridge calls will succeed or fail
     * @param _success Whether calls should succeed
     */
    function setBridgeSuccess(bool _success) external {
        bridgeSuccess = _success;
    }
    
    function getCallCount() external view returns (uint256) {
        return callCount;
    }
    
    /**
     * @notice Mock function for bridging ERC20 tokens
     * @param _data Arbitrary calldata
     * @return Success indicator
     */
    function callBridge(bytes calldata _data) external returns (bool) {
        lastBridgeData = _data;
        callCount++;
        
        if (!bridgeSuccess) {
            revert("Bridge call failed");
        }
        return true;
    }
    
    /**
     * @notice For receiving native tokens
     */
    receive() external payable {
        callCount++;
        
        if (!bridgeSuccess) {
            revert("Bridge call failed");
        }
    }
    
    /**
     * @notice Fallback function for arbitrary calls
     */
    fallback() external payable {
        callCount++;
        
        if (!bridgeSuccess) {
            revert("Bridge call failed");
        }
    }
} 