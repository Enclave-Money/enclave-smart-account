// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../enclave-smart-balance/interfaces/ISettlementModule.sol";

/**
 * @title MockSettlementModule
 * @notice Mock contract for testing components that interact with settlement modules
 */
contract MockSettlementModule is ISettlementModule {
    // Track if triggerSettlement was called
    bool public settlementTriggered;
    
    // Store the last transaction ID processed
    bytes32 public lastTransactionId;
    
    // Store the last reclaim plan received
    bytes public lastReclaimPlan;

    /**
     * @notice Implements the triggerSettlement function from ISettlementModule
     * @param reclaimPlan Encoded plan containing chain IDs, token addresses, amounts, and recipient info
     * @param transactionId Unique identifier for the settlement transaction
     */
    function triggerSettlement(
        bytes calldata reclaimPlan,
        bytes32 transactionId
    ) external override {
        settlementTriggered = true;
        lastTransactionId = transactionId;
        lastReclaimPlan = reclaimPlan;
        
        // Emit the event as defined in the interface
        uint32[] memory chainIds = new uint32[](1);
        chainIds[0] = 1; // Mock chain ID
        
        emit SettlementTriggered(transactionId, chainIds);
    }
    
    /**
     * @notice Resets the mock state
     */
    function reset() external {
        settlementTriggered = false;
        lastTransactionId = bytes32(0);
        delete lastReclaimPlan;
    }
    
    /**
     * @notice Emits the SettlementMessageReceived event to simulate receiving a settlement message
     * @param transactionId The transaction ID for the received settlement
     */
    function simulateSettlementMessageReceived(bytes32 transactionId) external {
        emit SettlementMessageReceived(transactionId);
    }
} 