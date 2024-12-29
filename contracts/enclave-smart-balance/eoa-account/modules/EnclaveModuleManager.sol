// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../../enclave-smart-account/EnclaveRegistry.sol";

contract EnclaveModuleManager {
    // Interface to the Enclave Registry
    EnclaveRegistry public immutable enclaveRegistry;

    // Mapping to store module states (enabled/disabled)
    mapping(address => bool) public moduleStates;

    // Events
    event ModuleEnabled(address indexed module);
    event ModuleDisabled(address indexed module);

    // Custom errors
    error UnauthorizedCaller();
    error InvalidModuleAddress();

    constructor(address _enclaveRegistry) {
        require(_enclaveRegistry != address(0), "Invalid registry address");
        enclaveRegistry = EnclaveRegistry(_enclaveRegistry);
    }

    /**
     * @dev Modifier to ensure only the registered module manager can call certain functions
     */
    modifier onlyModuleManager() {
        if (msg.sender != enclaveRegistry.getRegistryAddress("moduleManagerEoa")) {
            revert UnauthorizedCaller();
        }
        _;
    }

    /**
     * @dev Enable a module
     * @param moduleAddress The address of the module to enable
     */
    function enableModule(address moduleAddress) external onlyModuleManager {
        if (moduleAddress == address(0)) {
            revert InvalidModuleAddress();
        }
        
        moduleStates[moduleAddress] = true;
        emit ModuleEnabled(moduleAddress);
    }

    /**
     * @dev Disable a module
     * @param moduleAddress The address of the module to disable
     */
    function disableModule(address moduleAddress) external onlyModuleManager {
        if (moduleAddress == address(0)) {
            revert InvalidModuleAddress();
        }
        
        moduleStates[moduleAddress] = false;
        emit ModuleDisabled(moduleAddress);
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
