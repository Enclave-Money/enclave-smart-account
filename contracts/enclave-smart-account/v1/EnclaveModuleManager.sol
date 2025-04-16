// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../EnclaveRegistryV0.sol";

contract EnclaveModuleManager {
    // Interface to the Enclave Registry
    mapping(address => bool) public isAdmin;
    uint256 public adminCount;

    // Mapping to store module states (enabled/disabled)
    mapping(address => bool) public moduleStates;

    // Events
    event ModuleEnabled(address indexed module);
    event ModuleDisabled(address indexed module);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    // Custom errors
    error UnauthorizedCaller();
    error InvalidModuleAddress();
    error CannotRemoveLastAdmin();
    error ZeroAddress();
    error AlreadyAdmin();
    error NotAdmin();

    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        isAdmin[_owner] = true;
        adminCount = 1;
    }

    modifier _onlyAdmin() {
        if (!isAdmin[msg.sender]) {
            revert UnauthorizedCaller();
        }
        _;
    }

    function addAdmin(address _admin) external _onlyAdmin() {
        if (_admin == address(0)) revert ZeroAddress();
        if (isAdmin[_admin]) revert AlreadyAdmin();
        
        isAdmin[_admin] = true;
        adminCount++;
        emit AdminAdded(_admin);
    }

    function removeAdmin(address _admin) external _onlyAdmin() {
        if (!isAdmin[_admin]) revert NotAdmin();
        
        // Prevent removing the last admin
        if (adminCount <= 1) {
            revert CannotRemoveLastAdmin();
        }
        
        isAdmin[_admin] = false;
        adminCount--;
        emit AdminRemoved(_admin);
    }

    /**
     * @dev Enable a module
     * @param moduleAddress The address of the module to enable
     */
    function enableModule(address moduleAddress) external _onlyAdmin() {
        if (moduleAddress == address(0)) {
            revert InvalidModuleAddress();
        }
        
        // Skip state update and event emission if already enabled
        if (!moduleStates[moduleAddress]) {
            moduleStates[moduleAddress] = true;
            emit ModuleEnabled(moduleAddress);
        }
    }

    /**
     * @dev Disable a module
     * @param moduleAddress The address of the module to disable
     */
    function disableModule(address moduleAddress) external _onlyAdmin() {
        if (moduleAddress == address(0)) {
            revert InvalidModuleAddress();
        }
        
        // Skip state update and event emission if already disabled
        if (moduleStates[moduleAddress]) {
            moduleStates[moduleAddress] = false;
            emit ModuleDisabled(moduleAddress);
        }
    }

    /**
     * @dev Check if a module is enabled
     * @param moduleAddress The address of the module to check
     * @return bool indicating if the module is enabled
     */
    function isModuleEnabled(address moduleAddress) external view returns (bool) {
        return moduleStates[moduleAddress];
    }
}
