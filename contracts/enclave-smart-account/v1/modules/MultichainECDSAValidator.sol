// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "./IERC7579Module.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {UserOperationLib} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
import "../P256SmartAccountV1.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

/**
 * @title ECDSA Multichain Validator module for Biconomy Smart Accounts.
 * @dev Biconomy’s Multichain Validator module enables use cases which
 * require several actions to be authorized for several chains with just one
 * signature required from user.
 *         - Leverages Merkle Trees to efficiently manage large datasets
 *         - Inherits from the ECDSA Ownership Registry Module
 *         - Compatible with Biconomy Modular Interface v 0.1
 *         - Does not introduce any additional security trade-offs compared to the
 *           vanilla ERC-4337 flow.
 * @author Fil Makarov - <filipp.makarov@biconomy.io>
 */

contract MultichainECDSAValidator is IValidator {
    using UserOperationLib for UserOperation;

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
    ) external view virtual override returns (uint256) {
        require(!isDisabled[userOp.sender], "Module is disabled");
        address owner = P256SmartAccountV1(payable(userOp.sender)).eoaOwner();
        bytes32 hash;

        if (userOp.signature.length == 65) {
            //it's not a multichain signature
            hash = ECDSA.toEthSignedMessageHash(userOpHash);
            if (owner != ECDSA.recover(hash, userOp.signature)) {
                return 1;
            }
            return 0;
        }

        //otherwise it is a multichain signature
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

        hash = ECDSA.toEthSignedMessageHash(merkleTreeRoot);
        if (owner != ECDSA.recover(hash, multichainSignature)) {
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
        bytes32 hash_;

        if (sig.length == 65) {
            //it's not a multichain signature
            hash_ = ECDSA.toEthSignedMessageHash(hash);
            if (owner != ECDSA.recover(hash_, sig)) {
                return ERC1271_INVALID;
            }
            return ERC1271_MAGICVALUE;
        }

        //otherwise it is a multichain signature
        (
            uint48 validUntil,
            uint48 validAfter,
            bytes32 merkleTreeRoot,
            bytes32[] memory merkleProof,
            bytes memory multichainSignature
        ) = abi.decode(
                sig,
                (uint48, uint48, bytes32, bytes32[], bytes)
            );

        //make a leaf out of userOpHash, validUntil and validAfter
        bytes32 leaf = keccak256(
            abi.encodePacked(validUntil, validAfter, hash)
        );

        if (!MerkleProof.verify(merkleProof, merkleTreeRoot, leaf)) {
            revert("Invalid UserOp");
        }

        hash_ = ECDSA.toEthSignedMessageHash(merkleTreeRoot);
        if (owner != ECDSA.recover(hash_, multichainSignature)) {
            return ERC1271_INVALID;
        }
        return ERC1271_MAGICVALUE;
    }
}