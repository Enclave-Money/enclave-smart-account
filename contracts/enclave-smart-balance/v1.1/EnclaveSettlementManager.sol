// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../interfaces/ISettlementModule.sol";

contract EnclaveSettlementManager is Ownable {
    mapping(address => bool) public settlementModuleEnabled;

    event SettlementModuleEnabled(address indexed module);
    event SettlementModuleDisabled(address indexed module);

    error InvalidModuleAddress();
    error ModuleAlreadyEnabled();
    error ModuleAlreadyDisabled();
    error ModuleNotEnabled();
    error UnauthorizedModule();
    error InvalidModuleInterface();

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

        // Verify module implements ISettlementModule interface
        // First check if there's code at the address
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(module)
        }
        if (codeSize == 0) revert InvalidModuleInterface();

        // Check if the module supports the ISettlementModule interface using ERC165
        try
            IERC165(module).supportsInterface(
                type(ISettlementModule).interfaceId
            )
        returns (bool supported) {
            if (!supported) revert InvalidModuleInterface();
        } catch {
            // If the contract doesn't implement ERC165 or the call fails, revert
            revert InvalidModuleInterface();
        }

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
    function isSettlementModuleEnabled(
        address module
    ) external view returns (bool) {
        return settlementModuleEnabled[module];
    }
}
