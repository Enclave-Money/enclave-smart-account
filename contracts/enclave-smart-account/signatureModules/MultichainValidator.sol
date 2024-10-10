// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UserOperationLib} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {calldataKeccak, _packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "../utils/Base64URL.sol";
import "../P256Verifier.sol";
import "../EnclaveRegistry.sol";
import "../P256SmartAccount.sol";

contract MultichainPasskeyValidator {
    address enclaveRegistry;

    constructor (address _enclaveRegistry) {
        enclaveRegistry = _enclaveRegistry;
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
        (bytes memory moduleSignature, ) = abi.decode(
            userOp.signature,
            (bytes, address)
        );

        address sender;
        //read sender from userOp, which is first userOp member (saves gas)
        assembly {
            sender := calldataload(userOp)
        }

        (
            uint48 validUntil,
            uint48 validAfter,
            bytes32 merkleTreeRoot,
            bytes32[] memory merkleProof,
            bytes memory multichainSignature
        ) = abi.decode(
                moduleSignature,
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

        return P256Verifier(EnclaveRegistry(enclaveRegistry).getRegistryAddress("p256Verifier"))
            .ecdsa_verify(sigHash, r, s, [P256SmartAccount(payable(msg.sender)).pubKey(0), P256SmartAccount(payable(msg.sender)).pubKey(1)] );
    }
}