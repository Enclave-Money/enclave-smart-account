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

contract ECDSAValidator is IValidator {
    mapping(address => bool) internal isDisabled;

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
        address owner = P256SmartAccountV1(payable(userOp.sender)).eoaOwner();
        bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
        if (owner != ECDSA.recover(hash, userOp.signature)) {
            return 1;
        }
        return 0;
    }

    function isValidSignatureWithSender(address, bytes32 hash, bytes calldata sig)
        external
        view
        override
        returns (bytes4)
    {
        require(!isDisabled[msg.sender], "Module is disabled");
        address owner = P256SmartAccountV1(payable(msg.sender)).eoaOwner();
        if (owner == ECDSA.recover(hash, sig)) {
            return ERC1271_MAGICVALUE;
        }
        bytes32 ethHash = ECDSA.toEthSignedMessageHash(hash);
        address recovered = ECDSA.recover(ethHash, sig);
        if (owner != recovered) {
            return ERC1271_INVALID;
        }
        return ERC1271_MAGICVALUE;
    }
}