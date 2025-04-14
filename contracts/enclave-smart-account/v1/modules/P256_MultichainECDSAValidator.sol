// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "./IERC7579Module.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {UserOperationLib} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

contract P256_MultichainECDSAValidator is IValidator {
    using UserOperationLib for UserOperation;

    mapping(address => bool) internal isEnabled;
    mapping(address => address) public eoaAddress;

    function onInstall(bytes calldata data) external override {
        if (isInitialized(msg.sender)) revert AlreadyInitialized(msg.sender);
        isEnabled[msg.sender] = true;
        (address owner) = abi.decode(data, (address));
        eoaAddress[msg.sender] = owner;
    }

    function onUninstall(bytes calldata) external override {
        if (!isInitialized(msg.sender)) revert NotInitialized(msg.sender);
        isEnabled[msg.sender] = false;
        eoaAddress[msg.sender] = address(0);
    }

    function isInitialized(address smartAccount) public view override returns (bool) {
        return isEnabled[smartAccount];
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
        require(isEnabled[userOp.sender], "Module is disabled");
        address owner = eoaAddress[userOp.sender];
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


    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata sig)
        external
        view
        override
        returns (bytes4)
    {
        require(isEnabled[sender], "Module is disabled");
        address owner = eoaAddress[sender];
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