// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

interface IEnclaveNFTGasLogic {
    function isEligible(address user, address nft, uint256 gasAmount) external view returns (bool);
    function applyLogic(address user, address nft, uint256 actualGasCost) external returns (bool);
    function addOrUpdateNFTLimits(address nft, uint256 transactionLimit, uint256 gasValueLimit) external;
}