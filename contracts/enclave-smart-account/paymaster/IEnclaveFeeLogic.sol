// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

interface IEnclaveFeeLogic {
    function calculateFee(address token, uint256 actualGasCost) external view returns (uint256);
}