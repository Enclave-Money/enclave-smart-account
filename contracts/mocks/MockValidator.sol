// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

// Define UserOperation struct for validation
struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

contract MockValidator {
    bool public willRevert;
    bool public returnsInvalid;
    uint256 public validationResult;
    bytes4 public erc1271Result;
    bool public erc1271WillRevert;
    bool public erc1271ReturnsInvalid;
    
    constructor() {
        // Initialize with default values
        willRevert = false;
        returnsInvalid = false;
        validationResult = 0; // 0 means success in validateUserOp
        erc1271Result = 0x1626ba7e; // Default to valid signature
        erc1271WillRevert = false;
        erc1271ReturnsInvalid = false;
    }
    
    function setWillRevert(bool _willRevert) public {
        willRevert = _willRevert;
    }
    
    function setReturnsInvalid(bool _returnsInvalid) public {
        returnsInvalid = _returnsInvalid;
    }
    
    function setValidationResult(uint256 _result) public {
        validationResult = _result;
    }

    function setERC1271Result(bytes4 _result) public {
        erc1271Result = _result;
    }

    function setERC1271WillRevert(bool _willRevert) public {
        erc1271WillRevert = _willRevert;
    }

    function setERC1271ReturnsInvalid(bool _returnsInvalid) public {
        erc1271ReturnsInvalid = _returnsInvalid;
    }
    
    // This is called by the smart account to validate signatures
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) external view returns (uint256) {
        if (willRevert) {
            revert("MockValidator: forced revert");
        }
        
        if (returnsInvalid) {
            return 1; // Any non-zero value indicates validation failure
        }
        
        return validationResult;
    }
    
    // Implementing isValidSignature for ERC-1271 compatibility
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        if (willRevert) {
            revert("MockValidator: forced revert");
        }
        
        if (returnsInvalid) {
            return 0xffffffff; // Invalid signature
        }
        
        return 0x1626ba7e; // Magic value for valid signature per ERC-1271
    }

    // Implementing isValidSignatureWithSender for ERC-1271 compatibility
    function isValidSignatureWithSender(
        address sender,
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4) {
        if (erc1271WillRevert) {
            revert("MockValidator: ERC1271 forced revert");
        }
        
        if (erc1271ReturnsInvalid) {
            return 0xffffffff; // Invalid signature
        }
        
        return erc1271Result;
    }
} 