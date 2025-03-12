// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../socket-contracts/ISocket.sol";
import "../../socket-contracts/IPlug.sol";

import "./EnclaveVirtualLiquidityVault.sol";

import "../interfaces/ISettlementModule.sol";

import "hardhat/console.sol";

contract SocketDLSettlementModule is Ownable, ISettlementModule, IPlug {
    address public socket;
    address public inboundSwitchBoard;   
    address public outboundSwitchBoard;
    uint256 public settlementMessageGasLimit;
    uint256 public settlementMaxBatchSize;

    EnclaveVirtualLiquidityVault public vault;
    
    mapping(uint32 => address) public siblingPlugs;
    mapping(bytes32 => bool) public settledTransactionIds;

    constructor(
        address _vault,
        address _socket,
        address _inboundSb,
        address _outboundSb,
        uint256 _messageGasLimit,
        uint256 _maxBatchSize
    ) {
        vault = EnclaveVirtualLiquidityVault(payable(_vault));
        socket = _socket;
        inboundSwitchBoard = _inboundSb;
        outboundSwitchBoard = _outboundSb;
        settlementMessageGasLimit = _messageGasLimit;
        settlementMaxBatchSize = _maxBatchSize;
    }

    function triggerSettlement(
        bytes calldata reclaimPlan, 
        bytes32 transactionId
    ) external {
        require(msg.sender == address(vault), "SettlementModule: Invalid caller for triggerSettlement");

        (
            uint32[] memory chainIds, 
            address[] memory tokenAddresses,
            uint256[] memory amounts,
            address receiverAddress,
            address userAddress
        ) = abi.decode(reclaimPlan, (uint32[], address[], uint256[], address, address));

        console.log("Triggering Settlement");

        require(chainIds.length == tokenAddresses.length && chainIds.length == amounts.length, "Array lengths must match");
        require(chainIds.length <= settlementMaxBatchSize, "Batch too large");

        console.log("Settlement Plan Length Checks Passed");

        for (uint i = 0; i < chainIds.length;) {
            _sendSettlementMessage(
                chainIds[i],
                settlementMessageGasLimit,
                userAddress,
                tokenAddresses[i],
                amounts[i],
                receiverAddress,
                transactionId
            );
            unchecked { ++i; }
        }

        emit SettlementTriggered(transactionId, chainIds);
    }

    function _sendSettlementMessage(
        uint32 destinationChainSlug,
        uint256 gasLimit_,
        address userAddress, 
        address tokenAddress, 
        uint256 amount, 
        address receiverAddress,
        bytes32 transactionId
    ) internal {
        bytes memory payload = abi.encode(userAddress, tokenAddress, amount, receiverAddress, transactionId);
        uint256 fees = ISocket(socket).getMinFees(
            gasLimit_, 
            payload.length, 
            bytes32(0), 
            bytes32(0), 
            destinationChainSlug, 
            address(this)
        );
        
        console.log("Settlement Fees calculated: ", destinationChainSlug, fees);

        ISocket(socket).outbound{value: fees}(
            destinationChainSlug,
            gasLimit_,
            bytes32(0),
            bytes32(0),
            payload
        );
    }

    function connectToPlug(uint32 _remoteChainSlug, address _remotePlug) external onlyOwner {
        ISocket(socket).connect(
            _remoteChainSlug, 
            _remotePlug, 
            inboundSwitchBoard, 
            outboundSwitchBoard
        );
        siblingPlugs[_remoteChainSlug] = _remotePlug;
    }

    function inbound(
        uint32 srcChainSlug_,
        bytes calldata _payload
    ) external payable {
        require(msg.sender == socket, "Caller is not Socket");

        console.log("Module inbound");
        
        (
            address userAddress,
            address tokenAddress,
            uint256 amount,
            address receiverAddress,
            bytes32 transactionId
        ) = abi.decode(
            _payload,
            (address, address, uint256, address, bytes32)
        );

        console.log("User Address: ", userAddress);
        console.log("Token Address: ", tokenAddress);
        console.log("Amount: ", amount);
        console.log("Receiver Address: ", receiverAddress);
        console.log("Transaction ID: ", uint256(transactionId));

        require(!settledTransactionIds[transactionId], "Transaction ID already executed");
        settledTransactionIds[transactionId] = true;

        console.log("Calling inbound on vault");

        // Vault
        vault.inbound(userAddress, tokenAddress, amount, receiverAddress, transactionId);

        emit SettlementMessageReceived(transactionId);
    }

    receive() external payable {}
}
