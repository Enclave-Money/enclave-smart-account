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
import "../../enclave-smart-balance/interfaces/IEnclaveTokenVault.sol";

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
    bool public smartBalanceEnabled;

    function initialize(
        uint256[2] memory _pubKey,
        address _enclaveRegistry
    ) public virtual override initializer {
        // Call the initialize function of the superclass
        _initialize(_pubKey, _enclaveRegistry);
        
        // Set smartBalanceEnabled to true
        smartBalanceEnabled = true;
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        // Decode the validation mode and actual signature from userOp.signature
        (uint256 validationMode, bytes memory actualSignature) = abi.decode(userOp.signature, (uint256, bytes));

        console.log("validation mode: ", validationMode);
        console.log("signature: ", string(actualSignature));
        
        // Get validator address based on the mode
        address validator;
        if (validationMode == 0) {
            validator = EnclaveRegistry(enclaveRegistry).getRegistryAddress("P256Validator");
        } else if (validationMode == 1) {
            require(eoaOwner != address(0), "EOA not enabled");
            validator = EnclaveRegistry(enclaveRegistry).getRegistryAddress("ECDSAValidator");
        } else if (validationMode == 2) {
            validator = EnclaveRegistry(enclaveRegistry).getRegistryAddress("MultichainP256Validator");
        } else if (validationMode == 3) {
            require(eoaOwner != address(0), "EOA not enabled");
            validator = EnclaveRegistry(enclaveRegistry).getRegistryAddress("MultichainECDSAValidator");
        } else if (validationMode == 4) {
            validator = EnclaveRegistry(enclaveRegistry).getRegistryAddress("SessionKeyValidator");
        } else {
            return SIG_VALIDATION_FAILED;
        }
        
        console.log("selected validator: ", validator);

        // Create modified UserOperation with actual signature
        UserOperation memory modifiedUserOp = userOp;
        modifiedUserOp.signature = actualSignature;
    
        // Call the validator's validateUserOp function
        (bool success, bytes memory result) = validator.call(
            abi.encodeWithSignature(
                "validateUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32)",
                modifiedUserOp,
                userOpHash
            )
        );
    
        console.log("Account validation result: ", abi.decode(result, (uint256)));
        
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
    function setEoaOwner(address newOwner) external onlyOwner {
        eoaOwner = newOwner;
    }

    function setSmartBalanceEnabled(bool _smartBalanceEnabled) external onlyOwner {
        smartBalanceEnabled = _smartBalanceEnabled;
    }

    modifier onlySmartBalanceConversionManager() {
        require(
            msg.sender == address(this) ||
            msg.sender == EnclaveRegistry(enclaveRegistry).getRegistryAddress("smartBalanceConversionManager"),
            "Convert: Invalid caller"
        );
        _;
    }
    
    function smartBalanceConvert(address tokenAddress) external onlySmartBalanceConversionManager {
        require(smartBalanceEnabled, "Convert: Smart balance not enabled");

        IERC20 smartBalanceToken = IERC20(tokenAddress);
        IEnclaveTokenVaultV0 vault = IEnclaveTokenVaultV0(EnclaveRegistry(enclaveRegistry).getRegistryAddress("smartBalanceVault"));
        uint256 balance = smartBalanceToken.balanceOf(address(this));

        smartBalanceToken.approve(address(vault), balance);
        vault.deposit(tokenAddress, balance);
    }
}
