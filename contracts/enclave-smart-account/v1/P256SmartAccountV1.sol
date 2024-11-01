// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import { Base64URL } from "../utils/Base64URL.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

import "../EnclaveRegistry.sol";
import "../P256V.sol";
import "../P256SmartAccount.sol";

import "hardhat/console.sol";

/**
 * minimal account.
 *  this is sample minimal account.
 *  has execute, eth handling methods
 *  has a single signer that can send requests through the entryPoint.
 */
contract P256SmartAccountV1 is
    P256SmartAccount
{
    address public eoaOwner;

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        address _entryPoint = EnclaveRegistry(enclaveRegistry)
            .getRegistryAddress("entryPoint");
        return IEntryPoint(_entryPoint);
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        // Get the validation mode from the nonce
        uint256 validationMode = userOp.nonce;
        
        // Get validator address based on the mode
        address validator;
        if (validationMode == 0) {
            validator = EnclaveRegistry(enclaveRegistry).getRegistryAddress("P256Validator");
        } else if (validationMode == 1) {
            require(eoaOwner != address(0), "EOA Not enabled");
            validator = EnclaveRegistry(enclaveRegistry).getRegistryAddress("ECDSAValidator");
        } else if (validationMode == 2) {
            validator = EnclaveRegistry(enclaveRegistry).getRegistryAddress("MultichainECDSAValidator");
        } else if (validationMode == 3) {
            validator = EnclaveRegistry(enclaveRegistry).getRegistryAddress("MultichainP256Validator");
        } else if (validationMode == 4) {
            validator = EnclaveRegistry(enclaveRegistry).getRegistryAddress("SessionKeyValidator");
        } else {
            return SIG_VALIDATION_FAILED;
        }
        
        // Call the validator's validateUserOp function
        (bool success, bytes memory result) = validator.call(
            abi.encodeWithSignature(
                "validateUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32)",
                userOp,
                userOpHash
            )
        );
        
        // If the call failed or returned invalid data, return validation failed
        if (!success || result.length != 32) {
            return SIG_VALIDATION_FAILED;
        }
        
        // Return the validation result from the validator
        return abi.decode(result, (uint256));
    }

    /**
     * @notice Sets the EOA owner address
     * @param newOwner The address of the new EOA owner
     * @dev Can only be called by the contract itself (through execute)
     */
    function setEoaOwner(address newOwner) external {
        require(msg.sender == address(this), "Only callable by self");
        eoaOwner = newOwner;
    }
    
    /**
     * @notice Sets the EOA owner address to 0x
     * @dev Can only be called by the contract itself (through execute)
     */
    function disableEoaOwner() external {
        require(msg.sender == address(this), "Only callable by self");
        eoaOwner = address(0);
    }
}
