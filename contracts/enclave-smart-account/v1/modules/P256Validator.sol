// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "./IERC7579Module.sol";
import { UserOperation } from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import { Base64URL } from "../../utils/Base64URL.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "../../EnclaveRegistry.sol";
import "../../P256V.sol";
import "../../P256SmartAccount.sol";

import "hardhat/console.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

contract P256Validator is IValidator {
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
        view
        override
        returns (uint256)
    {
        require(!isDisabled[userOp.sender], "Module is disabled");
        (
            bytes32 keyHash,
            uint256 r,
            uint256 s,
            bytes memory authenticatorData,
            string memory clientDataJSONPre,
            string memory clientDataJSONPost
        ) = abi.decode(
            userOp.signature,
            (bytes32, uint256, uint256, bytes, string, string)
        );
        (keyHash);

        console.log("r", r);
        console.log("s", s);
        console.log("clientDataJSONPre", clientDataJSONPre);
        console.log("clientDataJSONPost", clientDataJSONPost);

        if (!_verifySignature(authenticatorData, clientDataJSONPre, clientDataJSONPost, userOpHash, r, s)) {
            console.log("Validation Failed");
            return 1;
        }

        console.log("Validation Success");
        return 0;
    }

    function isValidSignatureWithSender(address, bytes32 hash, bytes calldata data)
        external
        view
        override
        returns (bytes4)
    {
        require(!isDisabled[msg.sender], "Module is disabled");
        (
            bytes32 keyHash,
            uint256 r,
            uint256 s,
            bytes memory authenticatorData,
            string memory clientDataJSONPre,
            string memory clientDataJSONPost
        ) = abi.decode(
            data,
            (bytes32, uint256, uint256, bytes, string, string)
        );
        (keyHash);
        if (!_verifySignature(authenticatorData, clientDataJSONPre, clientDataJSONPost, hash, r, s)) {
            console.log("Validation Failed");
            return ERC1271_INVALID;
        }

        console.log("Validation Success");
        return ERC1271_MAGICVALUE;
    }

    function _verifySignature(
        bytes memory authenticatorData,
        string memory clientDataJSONPre,
        string memory clientDataJSONPost,
        bytes32 userOpHash,
        uint256 r,
        uint256 s
    ) internal view returns (bool) {
        string memory opHashBase64 = Base64URL.encode(
            bytes.concat(userOpHash)
        );

        string memory clientDataJSON = string.concat(
            clientDataJSONPre,
            opHashBase64,
            clientDataJSONPost
        );

        bytes32 clientHash = sha256(bytes(clientDataJSON));
        bytes32 sigHash = sha256(bytes.concat(authenticatorData, clientHash));

        return P256V(EnclaveRegistry(enclaveRegistry).getRegistryAddress("p256Verifier"))
            .verify(sigHash, r, s, [P256SmartAccount(payable(msg.sender)).pubKey(0), P256SmartAccount(payable(msg.sender)).pubKey(1)]);
    }
}