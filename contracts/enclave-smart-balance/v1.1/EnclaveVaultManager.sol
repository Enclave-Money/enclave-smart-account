// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IEnclaveTokenVaultV1.sol";
import "hardhat/console.sol";

contract EnclaveVaultManager {
    mapping(address => bool) public isVaultManager;

    event VaultManagerAdded(address indexed newVaultManager);
    event VaultManagerRemoved(address indexed removedVaultManager);

    constructor(
        address _vaultManager
    ) {
        isVaultManager[_vaultManager] = true;
        emit VaultManagerAdded(_vaultManager);
    }

    // Admin functions
    modifier onlyVaultManager() {
        require(isVaultManager[msg.sender], "Caller is not a vault manager");
        _;
    }

    /**
     * @notice Adds a new vault manager to the system
     * @param _newVaultManager Address to be added as a vault manager
     * @dev Only callable by existing vault managers
     * @dev Emits VaultManagerAdded event
     * @dev Cannot add zero address or existing vault managers
     */
    function addVaultManager(address _newVaultManager) external onlyVaultManager {
        require(_newVaultManager != address(0), "Invalid vault manager address");
        require(!isVaultManager[_newVaultManager], "Address is already a vault manager");
        isVaultManager[_newVaultManager] = true;
        emit VaultManagerAdded(_newVaultManager);
    }

    /**
     * @notice Removes a vault manager from the system
     * @param _vaultManager Address to be removed from vault managers
     * @dev Only callable by existing vault managers
     * @dev Cannot remove self as vault manager
     * @dev Emits VaultManagerRemoved event
     */
    function removeVaultManager(address _vaultManager) external onlyVaultManager {
        require(isVaultManager[_vaultManager], "Address is not a vault manager");
        require(msg.sender != _vaultManager, "Cannot remove self as vault manager");
        isVaultManager[_vaultManager] = false;
        emit VaultManagerRemoved(_vaultManager);
    }
}
