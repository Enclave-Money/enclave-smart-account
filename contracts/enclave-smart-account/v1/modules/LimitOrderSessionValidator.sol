// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IValidator, MODULE_TYPE_VALIDATOR } from "./IERC7579Module.sol";
import { UserOperation } from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../EnclaveRegistryV0.sol";

import "hardhat/console.sol";

bytes4 constant ERC1271_MAGICVALUE = 0x1626ba7e;
bytes4 constant ERC1271_INVALID = 0xffffffff;

bytes32 constant SMART_BALANCE_CONVERSION_MANAGER = keccak256(abi.encodePacked("smartBalanceConversionManager"));

contract LimitOrderSessionValidator is IValidator {
    EnclaveRegistryV0 enclaveRegistry;
    mapping(address => bool) internal isDisabled;

    constructor (address _enclaveRegistry) {
        enclaveRegistry = EnclaveRegistryV0(_enclaveRegistry);
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
        require(!isDisabled[userOp.sender], "Module is disabled");
        
        // Decode the batch operation data
        bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
        address smartBalManager = enclaveRegistry.getRegistryAddress(SMART_BALANCE_CONVERSION_MANAGER);
        console.log("smartBalManager: ", smartBalManager);
        console.log("Recovered Addr: ", ECDSA.recover(hash, userOp.signature));
        if (smartBalManager != ECDSA.recover(hash, userOp.signature)) {
            console.log("INCONTRACT: Sig val failed");
            return 1;
        }

        console.log("INCONTRACT: Sig val pass");
        return 0;
    }


    function isValidSignatureWithSender(address, bytes32 hash, bytes calldata sig)
        external
        view
        override
        returns (bytes4)
    {
        require(!isDisabled[msg.sender], "Module is disabled");
        
        bytes32 ethHash = ECDSA.toEthSignedMessageHash(hash);
        if (enclaveRegistry.getRegistryAddress(SMART_BALANCE_CONVERSION_MANAGER) != ECDSA.recover(ethHash, sig)) {
            return ERC1271_INVALID;
        }
        return ERC1271_MAGICVALUE;
    }
}