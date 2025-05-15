// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "./IERC7579Module.sol";
import { UserOperation } from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../EnclaveRegistryV0.sol";

import "hardhat/console.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;
bytes4 constant APPROVE_SELECTOR = 0x095ea7b3; // approve(address,uint256)
bytes4 constant DEPOSIT_SELECTOR = 0xb6b55f25; // deposit(address,uint256)

bytes32 constant SMART_BALANCE_CONVERSION_MANAGER = keccak256(abi.encodePacked("smartBalanceConversionManager"));
bytes32 constant SMART_BALANCE_VAULT = keccak256(abi.encodePacked("smartBalanceVault"));

contract SmartBalanceKeyValidatorV1 is IValidator {
    EnclaveRegistryV0 enclaveRegistry;
    mapping(address => bool) internal isDisabled;

    constructor (address _enclaveRegistry) {
        enclaveRegistry = EnclaveRegistryV0(_enclaveRegistry);
    }

    function onInstall(bytes calldata) external override {
        if (isInitialized(msg.sender)) revert AlreadyInitialized(msg.sender);
        isDisabled[msg.sender] = false;
    }

    function onUninstall(bytes calldata) external override {
        if (!isInitialized(msg.sender)) revert NotInitialized(msg.sender);
        isDisabled[msg.sender] = true;
    }

    function isInitialized(address smartAccount) public view override returns (bool) {
        return !isDisabled[smartAccount];
    }

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash
    )
        external
        override
        view
        returns (uint256)
    {
        require(!isDisabled[userOp.sender], "Module is disabled");
        
        // Decode the batch operation data
        (address[] memory dest, /* uint256[] memory value */, bytes[] memory func) = abi.decode(
            userOp.callData[4:], // Skip the function selector
            (address[], uint256[], bytes[])
        );

        // Validate the batch operation
        if (!_validateBatchOperation(dest, func)) {
            console.log("INCONTRACT: Batch operation validation failed");
            return 1;
        }

        bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
        address smartBalManager = enclaveRegistry.getRegistryAddress(SMART_BALANCE_CONVERSION_MANAGER);
        console.log("smartBalManager: ", smartBalManager);
        console.log("Recovered Addr: ", ECDSA.recover(hash, userOp.signature));
        if (smartBalManager != ECDSA.recover(hash, userOp.signature)) {
            console.log("INCONTRACT: Sig val failed");
            return 1;
        }

        console.log("INCONTRACT: Sig val pass");
        return 0;
    }

    function _validateBatchOperation(
        address[] memory dest,
        bytes[] memory func
    ) internal view returns (bool) {
        // Must have exactly 2 operations
        if (dest.length > 3 || func.length  > 3) {
            console.log("Sub op length incorrect: ", dest.length, func.length);
            return false;
        }

        for (uint256 i = 0; i < func.length; i++) {
            if (bytes4(func[i]) == APPROVE_SELECTOR) {
                console.log("Matched approve selector");
                continue;
            } else if (bytes4(func[i]) == DEPOSIT_SELECTOR) {
                address vaultAddress = enclaveRegistry.getRegistryAddress(SMART_BALANCE_VAULT);
                console.log("Matched deposit selector");
                if (dest[i] != vaultAddress) {
                    console.log("failure: Match vault address for deposit function");
                    return false;
                }
            } else {
                return false;
            }
        }

        return true;
    }

    function isValidSignatureWithSender(address, bytes32 hash, bytes calldata sig)
        external
        view
        override
        returns (bytes4)
    {
        require(!isDisabled[msg.sender], "Module is disabled");
        
        bytes32 ethHash = ECDSA.toEthSignedMessageHash(hash);
        if (enclaveRegistry.getRegistryAddress(SMART_BALANCE_CONVERSION_MANAGER) != ECDSA.recover(ethHash, sig)) {
            return ERC1271_INVALID;
        }
        return ERC1271_MAGICVALUE;
    }
}