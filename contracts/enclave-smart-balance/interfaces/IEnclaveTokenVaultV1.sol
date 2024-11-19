// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IEnclaveTokenVault.sol";

interface IEnclaveTokenVaultV1 is IEnclaveTokenVaultV0 {

    // Vault Manager Gated Withdrawals
    
    // Events
    event Withdrawn(address indexed user, address indexed tokenAddress, uint256 amount, address indexed vaultManager);

    // State-changing functions
    function withdrawSigned(address _tokenAddress, uint256 _amount, bytes calldata signature) external;
}
