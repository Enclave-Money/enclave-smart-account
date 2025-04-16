// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "./IERC7579Module.sol";
import { UserOperation } from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "hardhat/console.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

contract SessionKeyValidator is IValidator {
    mapping(address => bool) internal isDisabled;
    mapping(address => bytes32) smartAccountSessionKeyRoot;

    event RootUpdated(address indexed smartAccount, uint256 indexed timestamp);

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

    function updateRoot(bytes32 merkleRoot) external {
        smartAccountSessionKeyRoot[msg.sender] = merkleRoot;
        emit RootUpdated(msg.sender, block.timestamp);
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
        bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
        (
            uint256 validUntil, 
            uint256 validAfter, 
            bytes memory sessionKeyData,
            bytes32[] memory merkleProof, 
            bytes memory sessionKeySignature
        ) = abi.decode(
            userOp.signature,
            (uint256, uint256, bytes, bytes32[], bytes)
        );

        address sessionKey = ECDSA.recover(hash, sessionKeySignature);

        (
            bytes4 functionSig,
            address contractAddress
        ) = abi.decode(
            sessionKeyData,
            (bytes4, address)
        );

        bytes32 leaf = keccak256(abi.encode(
            validUntil, validAfter, contractAddress, functionSig, sessionKey
        ));

        bytes32 merkleRoot = smartAccountSessionKeyRoot[msg.sender];

        if (!MerkleProof.verify(merkleProof, merkleRoot, leaf)) {
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
        bytes32 ethHash = ECDSA.toEthSignedMessageHash(hash);
        (
            uint256 validUntil, 
            uint256 validAfter, 
            bytes memory sessionKeyData,
            bytes32[] memory merkleProof, 
            bytes memory sessionKeySignature
        ) = abi.decode(
            sig,
            (uint256, uint256, bytes, bytes32[], bytes)
        );

        address sessionKey = ECDSA.recover(ethHash, sessionKeySignature);

        (
            bytes4 functionSig,
            address contractAddress
        ) = abi.decode(
            sessionKeyData,
            (bytes4, address)
        );

        bytes32 leaf = keccak256(abi.encode(
            validUntil, validAfter, contractAddress, functionSig, sessionKey
        ));

        bytes32 merkleRoot = smartAccountSessionKeyRoot[msg.sender];

        if (!MerkleProof.verify(merkleProof, merkleRoot, leaf)) {
            return ERC1271_INVALID;
        }
        return ERC1271_MAGICVALUE;
    }
}