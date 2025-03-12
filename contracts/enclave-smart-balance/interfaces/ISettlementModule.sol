// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISettlementModule {
    /**
     * @notice Triggers settlement across multiple chains
     * @param reclaimPlan Encoded plan containing chain IDs, token addresses, amounts, and recipient info
     * @param transactionId Unique identifier for the settlement transaction
     * @dev reclaimPlan format: (uint32[], address[], uint256[], address, address) 
     *      representing (chainIds, tokenAddresses, amounts, receiverAddress, userAddress)
     */
    function triggerSettlement(
        bytes calldata reclaimPlan,
        bytes32 transactionId
    ) external;

    /**
     * @notice Event emitted when settlement is triggered
     * @param transactionId The unique identifier for the settlement transaction
     * @param chainIds The list of chain IDs where settlement is being processed
     */
    event SettlementTriggered(bytes32 indexed transactionId, uint32[] chainIds);

    /**
     * @notice Event emitted when a settlement message is received
     * @param transactionId The unique identifier for the settlement transaction
     */
    event SettlementMessageReceived(bytes32 transactionId);
}