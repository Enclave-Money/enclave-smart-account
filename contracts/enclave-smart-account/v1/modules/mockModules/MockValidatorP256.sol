// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "../IERC7579Module.sol";
import { UserOperation } from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "../../../EnclaveRegistryV0.sol";

import "hardhat/console.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

contract MockValidatorP256 is IValidator {
    EnclaveRegistryV0 enclaveRegistry;
    mapping(address => bool) internal isDisabled;
    uint256 public validationResult;
    
    // New state variables for test scenarios
    bool public willRevert;
    bool public returnsInvalid;
    bool public erc1271WillRevert;
    bool public erc1271ReturnsInvalid;
    bytes4 public erc1271Result;

    constructor (address _enclaveRegistry) {
        enclaveRegistry = EnclaveRegistryV0(_enclaveRegistry);
        validationResult = 0;
        willRevert = false;
        returnsInvalid = false;
        erc1271WillRevert = false;
        erc1271ReturnsInvalid = false;
        erc1271Result = ERC1271_MAGICVALUE;
    }

    function setValidationResult(uint256 _result) external {
        validationResult = _result;
    }
    
    // New functions to control test behavior
    function setWillRevert(bool _willRevert) external {
        willRevert = _willRevert;
    }
    
    function setReturnsInvalid(bool _returnsInvalid) external {
        returnsInvalid = _returnsInvalid;
    }
    
    function setERC1271WillRevert(bool _willRevert) external {
        erc1271WillRevert = _willRevert;
    }
    
    function setERC1271ReturnsInvalid(bool _returnsInvalid) external {
        erc1271ReturnsInvalid = _returnsInvalid;
    }
    
    function setERC1271Result(bytes4 _result) external {
        erc1271Result = _result;
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
        override
        view
        returns (uint256)
    {
        console.log("MockP256 UserOp Validation Mode: ", userOp.nonce);
        
        // Test behaviors
        if (willRevert) {
            revert("Mock validator reverted");
        }
        
        if (returnsInvalid) {
            // Return a value that will cause validation to fail
            return 1; // Simple value for validation failed
        }
        
        return validationResult;
    }

    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata sig)
        external
        override
        view
        returns (bytes4)
    {
        console.log("MockP256 UserOp Validation 1271");
        
        // Test behaviors
        if (erc1271WillRevert) {
            revert("Mock validator ERC1271 reverted");
        }
        
        if (erc1271ReturnsInvalid) {
            return ERC1271_INVALID;
        }
        
        return erc1271Result;
    }
}