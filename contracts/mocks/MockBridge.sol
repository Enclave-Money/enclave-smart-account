// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MockBridge
 * @notice Mock contract for testing bridge integration
 */
contract MockBridge {
    bool public bridgeSuccess = true;
    
    /**
     * @notice Sets whether bridge calls will succeed or fail
     * @param _success Whether calls should succeed
     */
    function setBridgeSuccess(bool _success) external {
        bridgeSuccess = _success;
    }
    
    /**
     * @notice Mock function for bridging ERC20 tokens
     * @param data Arbitrary calldata
     * @return Success indicator
     */
    function callBridge(bytes calldata data) external returns (bool) {
        if (!bridgeSuccess) {
            revert("Bridge call failed");
        }
        return true;
    }
    
    /**
     * @notice For receiving native tokens
     */
    receive() external payable {
        if (!bridgeSuccess) {
            revert("Bridge call failed");
        }
    }
    
    /**
     * @notice Fallback function for arbitrary calls
     */
    fallback() external payable {
        if (!bridgeSuccess) {
            revert("Bridge call failed");
        }
    }
} 