// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

contract EnclaveFeeLogicTestnet {

    uint256 USDC_DECIMALS = 6;
    uint256 ETH_DECIMALS = 18;

    function calculateFee(uint256 actualGasCost) external view returns (uint256) {
        // 10^18 ETH = 2500 * 10^6 USDC
        // Fee in USDC
        return actualGasCost * 2500 / 10**(ETH_DECIMALS-USDC_DECIMALS);
    }
}