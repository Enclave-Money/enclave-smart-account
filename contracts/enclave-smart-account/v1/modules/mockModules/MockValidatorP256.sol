// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "../IERC7579Module.sol";
import { UserOperation } from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "../../../EnclaveRegistry.sol";

import "hardhat/console.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

contract MockValidatorP256 is IValidator {
    EnclaveRegistry enclaveRegistry;
    mapping(address => bool) internal isDisabled;
    uint256 public validationResult;

    constructor (address _enclaveRegistry) {
        enclaveRegistry = EnclaveRegistry(_enclaveRegistry);
        validationResult = 0;
    }

    function setValidationResult(uint256 _result) external {
        validationResult = _result;
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
        return validationResult;
    }

    function isValidSignatureWithSender(address, bytes32, bytes calldata)
        external
        view
        override
        returns (bytes4)
    {
        console.log("MockP256 UserOp Validation 1271");
        return ERC1271_MAGICVALUE;
    }
}