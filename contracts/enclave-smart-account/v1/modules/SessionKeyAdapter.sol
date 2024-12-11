// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "./IERC7579Module.sol";
import { UserOperation } from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import { Base64URL } from "../../utils/Base64URL.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../../EnclaveRegistry.sol";
import "../../P256V.sol";
import "../P256SmartAccountV1.sol";

import "hardhat/console.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

contract SessionKeyAdapter is IValidator {
    mapping(address => bool) internal isDisabled;
    EnclaveRegistry enclaveRegistry;

    event RootUpdated(address indexed smartAccount, uint256 indexed timestamp);

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
        view
        override
        returns (uint256)
    {
        (
            address validator, 
            bytes memory actualSignature
        ) = abi.decode(
            userOp.signature,
            (address, bytes)
        );

        // Create modified UserOperation with actual signature
        UserOperation memory modifiedUserOp = userOp;
        modifiedUserOp.signature = actualSignature;

        // Call the validator's validateUserOp function
        (bool success, bytes memory result) = validator.staticcall(
            abi.encodeWithSignature(
                "validateUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32)",
                modifiedUserOp,
                userOpHash
            )
        );
    
        console.log("Account validation result: ", abi.decode(result, (uint256)));
        
        // If the call failed or returned invalid data, return validation failed
        if (!success || result.length != 32) {
            return 1;
        }
        
        // Return the validation result from the validator
        return abi.decode(result, (uint256));
    }

    function isValidSignatureWithSender(address user, bytes32 hash, bytes calldata sig)
        external
        view
        override
        returns (bytes4)
    {
        (
            address validator, 
            bytes memory actualSignature
        ) = abi.decode(
            sig,
            (address, bytes)
        );

        // Use staticcall instead of call
        (bool success, bytes memory result) = validator.staticcall(
            abi.encodeWithSignature(
                "isValidSignatureWithSender(address, bytes32, bytes)",
                user,
                hash,
                actualSignature
            )
        );
    
        console.log("Account validation result: ", abi.decode(result, (uint256)));
        
        // If the call failed or returned invalid data, return validation failed
        if (!success || result.length != 32) {
            return ERC1271_INVALID;
        }
        
        // Return the validation result from the validator
        return abi.decode(result, (bytes4));
    }
}