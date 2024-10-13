// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEnclaveTokenVaultV0 {
    // Events
    event Deposited(address indexed user, address indexed tokenAddress, uint256 amount);
    event Withdrawn(address indexed user, address indexed tokenAddress, uint256 amount);
    event Claimed(address indexed solver, address indexed tokenAddress, uint256 amount, address indexed owner);
    event VaultManagerAdded(address indexed newVaultManager);
    event VaultManagerRemoved(address indexed removedVaultManager);

    // View functions
    function deposits(address tokenAddress, address user) external view returns (uint256);
    function isVaultManager(address manager) external view returns (bool);

    // State-changing functions
    function addVaultManager(address _newVaultManager) external;
    function removeVaultManager(address _vaultManager) external;
    function deposit(address _tokenAddress, uint256 _amount) external;
    function withdraw(address _tokenAddress, uint256 _amount) external;
    function claim(address _tokenAddress, uint256 _amount, bytes calldata _proof) external;
}
