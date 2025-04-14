// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "./IERC7579Module.sol";
import {UserOperationLib} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {calldataKeccak, _packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "../../utils/Base64URL.sol";
import "../../P256V.sol";
import "../../EnclaveRegistry.sol";
import "../P256SmartAccountV1.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

contract MultichainP256Validator is IValidator {
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

    /**
     * @dev Validates User Operation.
     * leaf = validUntil + validAfter + userOpHash
     * If the leaf is the part of the Tree with a root provided, userOp considered
     * to be authorized by user
     * @param userOp user operation to be validated
     * @param userOpHash hash of the userOp provided by the EP
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) external view virtual returns (uint256) {
        require(!isDisabled[userOp.sender], "Module is disabled");
        (
            uint48 validUntil,
            uint48 validAfter,
            bytes32 merkleTreeRoot,
            bytes32[] memory merkleProof,
            bytes memory multichainSignature
        ) = abi.decode(
                userOp.signature,
                (uint48, uint48, bytes32, bytes32[], bytes)
            );

        //make a leaf out of userOpHash, validUntil and validAfter
        bytes32 leaf = keccak256(
            abi.encodePacked(validUntil, validAfter, userOpHash)
        );

        if (!MerkleProof.verify(merkleProof, merkleTreeRoot, leaf)) {
            revert("Invalid UserOp");
        }

        (
            bytes32 keyHash,
            uint256 r,
            uint256 s,
            bytes memory authenticatorData,
            string memory clientDataJSONPre,
            string memory clientDataJSONPost
        ) = abi.decode(
            multichainSignature,
            (bytes32, uint256, uint256, bytes, string, string)
        );
        (keyHash);

        return
            _verifySignature(
                authenticatorData,
                clientDataJSONPre,
                clientDataJSONPost,
                merkleTreeRoot,
                r,
                s
            )
                ? 0
                : 1;
    }

    function isValidSignatureWithSender(address, bytes32 hash, bytes calldata data)
        external
        view
        override
        returns (bytes4)
    {
        require(!isDisabled[msg.sender], "Module is disabled");
        if (data.length == 0) {
            return ERC1271_INVALID;
        }

        (
            uint48 validUntil,
            uint48 validAfter,
            bytes32 merkleTreeRoot,
            bytes32[] memory merkleProof,
            bytes memory multichainSignature
        ) = abi.decode(
                data,
                (uint48, uint48, bytes32, bytes32[], bytes)
            );

        // Make a leaf out of hash, validUntil and validAfter
        bytes32 leaf = keccak256(
            abi.encodePacked(validUntil, validAfter, hash)
        );

        if (!MerkleProof.verify(merkleProof, merkleTreeRoot, leaf)) {
            return ERC1271_INVALID;
        }

        (
            bytes32 keyHash,
            uint256 r,
            uint256 s,
            bytes memory authenticatorData,
            string memory clientDataJSONPre,
            string memory clientDataJSONPost
        ) = abi.decode(
            multichainSignature,
            (bytes32, uint256, uint256, bytes, string, string)
        );
        (keyHash);

        return _verifySignature(
            authenticatorData,
            clientDataJSONPre,
            clientDataJSONPost,
            merkleTreeRoot,
            r,
            s
        ) ? ERC1271_MAGICVALUE : ERC1271_INVALID;
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
        .verify(sigHash, r, s, [P256SmartAccountV1(payable(msg.sender)).pubKey(0), P256SmartAccountV1(payable(msg.sender)).pubKey(1)]);
    }
}