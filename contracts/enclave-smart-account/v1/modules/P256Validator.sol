// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IValidator, MODULE_TYPE_VALIDATOR} from "./IERC7579Module.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {Base64URL} from "../../utils/Base64URL.sol";
import "../EnclaveModuleManager.sol";
import "../P256SmartAccountV1.sol";

// Custom errors
error AlreadyInitialized(address account);
error NotInitialized(address account);
error ModuleDisabled();
error InvalidCaller();
error VerificationFailed();

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

contract P256Validator is IValidator {
    EnclaveModuleManager immutable moduleManager;
    address public precompile;

    mapping(address => bool) internal isDisabled;

    constructor(address _moduleManager, address _precompile) {
        moduleManager = EnclaveModuleManager(_moduleManager);
        precompile = _precompile;
    }

    function setPrecompile(address _precompile) external {
        if (!moduleManager.isAdmin(msg.sender)) revert InvalidCaller();
        precompile = _precompile;
    }

    function onInstall(bytes calldata) external override {
        if (isInitialized(msg.sender)) revert AlreadyInitialized(msg.sender);
        isDisabled[msg.sender] = false;
    }

    function onUninstall(bytes calldata) external override {
        if (!isInitialized(msg.sender)) revert NotInitialized(msg.sender);
        isDisabled[msg.sender] = true;
    }

    function isInitialized(
        address smartAccount
    ) public view override returns (bool) {
        return !isDisabled[smartAccount];
    }

    function isModuleType(
        uint256 moduleTypeId
    ) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) external view override returns (uint256) {
        if (isDisabled[userOp.sender]) revert ModuleDisabled();

        (
            ,
            uint256 r,
            uint256 s,
            bytes memory authenticatorData,
            string memory clientDataJSONPre,
            string memory clientDataJSONPost
        ) = abi.decode(
                userOp.signature,
                (bytes32, uint256, uint256, bytes, string, string)
            );

        return
            _verifySignature(
                userOp.sender,
                authenticatorData,
                clientDataJSONPre,
                clientDataJSONPost,
                userOpHash,
                r,
                s
            )
                ? 0
                : 1;
    }

    function isValidSignatureWithSender(
        address sender,
        bytes32 hash,
        bytes calldata data
    ) external view override returns (bytes4) {
        if (isDisabled[sender]) revert ModuleDisabled();

        (
            ,
            uint256 r,
            uint256 s,
            bytes memory authenticatorData,
            string memory clientDataJSONPre,
            string memory clientDataJSONPost
        ) = abi.decode(
                data,
                (bytes32, uint256, uint256, bytes, string, string)
            );

        return
            _verifySignature(
                sender,
                authenticatorData,
                clientDataJSONPre,
                clientDataJSONPost,
                hash,
                r,
                s
            )
                ? ERC1271_MAGICVALUE
                : ERC1271_INVALID;
    }

    function _verifySignature(
        address sender,
        bytes memory authenticatorData,
        string memory clientDataJSONPre,
        string memory clientDataJSONPost,
        bytes32 userOpHash,
        uint256 r,
        uint256 s
    ) internal view returns (bool) {
        string memory opHashBase64 = Base64URL.encode(bytes.concat(userOpHash));
        string memory clientDataJSON = string.concat(
            clientDataJSONPre,
            opHashBase64,
            clientDataJSONPost
        );
        bytes32 clientHash = sha256(bytes(clientDataJSON));
        bytes32 sigHash = sha256(bytes.concat(authenticatorData, clientHash));

        return
            verify(
                sigHash,
                r,
                s,
                [
                    P256SmartAccountV1(payable(sender)).pubKey(0),
                    P256SmartAccountV1(payable(sender)).pubKey(1)
                ]
            );
    }

    function verify(
        bytes32 message_hash,
        uint256 r,
        uint256 s,
        uint256[2] memory pubKey
    ) public view returns (bool) {
        // Optimize memory usage by combining operations
        bytes memory input = abi.encodePacked(
            message_hash,
            r,
            s,
            pubKey[0],
            pubKey[1]
        );

        (bool success, bytes memory output) = precompile.staticcall(input);

        if (!success) revert VerificationFailed();
        return abi.decode(output, (bool));
    }
}
