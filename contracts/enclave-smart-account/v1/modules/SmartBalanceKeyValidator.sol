// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "./IERC7579Module.sol";
import { UserOperation } from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import { Base64URL } from "../../utils/Base64URL.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../../P256V.sol";
import "../P256SmartAccountV1.sol";

import "hardhat/console.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;
bytes4 constant SMART_BALANCE_CONVERT_SELECTOR = 0xf7558a84;

contract SmartBalanceKeyValidator is IValidator {
    EnclaveRegistry enclaveRegistry;
    mapping(address => bool) internal isDisabled;

    constructor (address _enclaveRegistry) {
        enclaveRegistry = EnclaveRegistry(_enclaveRegistry);
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
        
        // Decode the calldata
        (/* address dest */, /* uint256 value */, bytes memory func) = abi.decode(
            userOp.callData[4:], // Skip the function selector (first 4 bytes)
            (address, uint256, bytes)
        );

        // Convert func to bytes4
        bytes4 selector;
        assembly {
            selector := mload(add(func, 32))
        }

        console.log("INCONTRACT: ", Strings.toHexString(uint32(selector)));

        if (selector != SMART_BALANCE_CONVERT_SELECTOR) {
            console.log("INCONTRACT: Conversion func val failed");
            return 1;
        }

        bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
        address smartBalManager = enclaveRegistry.getRegistryAddress("smartBalanceConversionManager");
        console.log("smartBalManager: ", smartBalManager);
        console.log("Recovered Addr: ", ECDSA.recover(hash, userOp.signature));
        if (smartBalManager != ECDSA.recover(hash, userOp.signature)) {
            console.log("INCONTRACT: Sig val failed");
            return 1;
        }

        console.log("INCONTRACT: Sig val pass");
        return 0;
    }

    function isValidSignatureWithSender(address, bytes32 hash, bytes calldata sig)
        external
        view
        override
        returns (bytes4)
    {
        require(!isDisabled[msg.sender], "Module is disabled");
        
        bytes32 ethHash = ECDSA.toEthSignedMessageHash(hash);
        if (enclaveRegistry.getRegistryAddress("smartBalanceConversionManager") != ECDSA.recover(ethHash, sig)) {
            return ERC1271_INVALID;
        }
        return ERC1271_MAGICVALUE;
    }
}