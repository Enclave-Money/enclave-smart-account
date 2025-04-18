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
    
    constructor() {
        // Initialize with default values
        willRevert = false;
        returnsInvalid = false;
        validationResult = 0; // 0 means success in validateUserOp
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
} 