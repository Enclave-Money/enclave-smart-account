// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract EnclaveSettlementManager is Ownable {
    mapping(address => bool) public settlementModuleEnabled;

    event SettlementModuleEnabled(address indexed module);
    event SettlementModuleDisabled(address indexed module);

    error InvalidModuleAddress();
    error ModuleAlreadyEnabled();
    error ModuleAlreadyDisabled();
    error ModuleNotEnabled();
    error UnauthorizedModule();

    /**
     * @notice Modifier to ensure only enabled settlement modules can call certain functions
     */
    modifier onlySettlementModule() {
        if (!settlementModuleEnabled[msg.sender]) revert UnauthorizedModule();
        _;
    }

    /**
     * @notice Enables a settlement module
     * @param module The address of the settlement module to enable
     */
    function enableSettlementModule(address module) external onlyOwner {
        if (module == address(0)) revert InvalidModuleAddress();
        if (settlementModuleEnabled[module]) revert ModuleAlreadyEnabled();
        
        settlementModuleEnabled[module] = true;
        emit SettlementModuleEnabled(module);
    }

    /**
     * @notice Disables a settlement module
     * @param module The address of the settlement module to disable
     */
    function disableSettlementModule(address module) external onlyOwner {
        if (module == address(0)) revert InvalidModuleAddress();
        if (!settlementModuleEnabled[module]) revert ModuleAlreadyDisabled();
        
        settlementModuleEnabled[module] = false;
        emit SettlementModuleDisabled(module);
    }

    /**
     * @notice Checks if a settlement module is enabled
     * @param module The address of the settlement module to check
     * @return bool True if the module is enabled, false otherwise
     */
    function isSettlementModuleEnabled(address module) external view returns (bool) {
        return settlementModuleEnabled[module];
    }
}
