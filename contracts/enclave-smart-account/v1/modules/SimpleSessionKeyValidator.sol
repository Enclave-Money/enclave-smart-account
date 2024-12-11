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

contract SimpleSessionKeyValidator is IValidator {
    mapping(address => bool) internal isDisabled;
    
    // New storage for session keys
    struct SessionKeyData {
        bool isEnabled;
        uint256 validAfter;
        uint256 validUntil;
    }
    mapping(address => mapping(address => SessionKeyData)) public sessionKeys;

    // Status constants
    uint8 constant STATUS_DISABLED = 0;
    uint8 constant STATUS_ENABLED = 1;
    uint8 constant STATUS_EXPIRED = 2;
    uint8 constant STATUS_PREMATURE = 3;

    EnclaveRegistry enclaveRegistry;

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

    function enableSessionKey(
        address sessionKey,
        uint256 validAfter,
        uint256 validUntil
    ) external {
        require(validUntil > validAfter, "Invalid time range");
        
        sessionKeys[msg.sender][sessionKey] = SessionKeyData({
            isEnabled: true,
            validAfter: validAfter,
            validUntil: validUntil
        });
    }

    function disableSessionKey(address sessionKey) external {
        require(sessionKeys[msg.sender][sessionKey].isEnabled, "Session key not enabled");
        
        sessionKeys[msg.sender][sessionKey].isEnabled = false;
    }

    function getSessionKeyStatus(address wallet, address sessionKey) public view returns (uint8) {
        SessionKeyData memory data = sessionKeys[wallet][sessionKey];
        
        if (!data.isEnabled) return STATUS_DISABLED;
        if (block.timestamp > data.validUntil) return STATUS_EXPIRED;
        if (block.timestamp < data.validAfter) return STATUS_PREMATURE;
        return STATUS_ENABLED;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) external override view returns (uint256) {
        require(!isDisabled[userOp.sender], "Module is disabled");
        
        bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
        address sessionKey = ECDSA.recover(hash, userOp.signature);
        
        uint8 status = getSessionKeyStatus(userOp.sender, sessionKey);
        if (status != STATUS_ENABLED) return 1;
        
        return 0;
    }

    function isValidSignatureWithSender(
        address sender,
        bytes32 hash,
        bytes calldata sig
    ) external view override returns (bytes4) {
        require(!isDisabled[msg.sender], "Module is disabled");
        
        bytes32 ethHash = ECDSA.toEthSignedMessageHash(hash);
        address sessionKey = ECDSA.recover(ethHash, sig);
        
        uint8 status = getSessionKeyStatus(sender, sessionKey);
        if (status != STATUS_ENABLED) return ERC1271_INVALID;
        
        return ERC1271_MAGICVALUE;
    }
}