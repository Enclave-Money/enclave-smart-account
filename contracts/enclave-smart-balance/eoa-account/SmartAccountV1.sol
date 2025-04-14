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
import "@account-abstraction/contracts/samples/callback/TokenCallbackHandler.sol";

import "../../enclave-smart-account/EnclaveRegistry.sol";
import "../../enclave-smart-balance/interfaces/IEnclaveTokenVault.sol";

import "../../enclave-smart-account/v1/EnclaveModuleManager.sol";

import "hardhat/console.sol";
/**
 * minimal account.
 *  this is sample minimal account.
 *  has execute, eth handling methods
 *  has a single signer that can send requests through the entryPoint.
 */
contract SmartAccountV1 is BaseAccount, TokenCallbackHandler, UUPSUpgradeable, Initializable {
    using ECDSA for bytes32;

    address public owner;
    address public enclaveRegistry;
    bool public smartBalanceEnabled;

    event SmartAccountInitialized(address indexed owner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SmartBalanceStatusChanged(bool indexed enabled);

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        address _entryPoint = EnclaveRegistry(enclaveRegistry)
            .getRegistryAddress("entryPoint");
        return IEntryPoint(_entryPoint);
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    constructor() {
        _disableInitializers();
    }

    function _onlyOwner() internal view {
        //directly from EOA owner, or through the account itself (which gets redirected through execute())
        require(msg.sender == owner || msg.sender == address(this), "only owner");
    }

    /**
     * execute a transaction (called directly from owner, or by entryPoint)
     * @param dest destination address to call
     * @param value the value to pass in this call
     * @param func the calldata to pass in this call
     */
    function execute(address dest, uint256 value, bytes calldata func) external {
        _requireFromEntryPointOrOwner();
        _call(dest, value, func);
    }

    /**
     * execute a sequence of transactions
     * @dev to reduce gas consumption for trivial case (no value), use a zero-length array to mean zero value
     * @param dest an array of destination addresses
     * @param value an array of values to pass to each call. can be zero-length for no-value calls
     * @param func an array of calldata to pass to each call
     */
    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external {
        _requireFromEntryPointOrOwner();
        require(dest.length == func.length && (value.length == 0 || value.length == func.length), "wrong array lengths");
        if (value.length == 0) {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], 0, func[i]);
            }
        } else {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], value[i], func[i]);
            }
        }
    }

    /**
     * @dev The _entryPoint member is immutable, to reduce gas consumption.  To upgrade EntryPoint,
     * a new implementation of SimpleAccount must be deployed with the new EntryPoint address, then upgrading
     * the implementation by calling `upgradeTo()`
     * @param anOwner the owner (signer) of this account
     */
    function initialize(address anOwner, address _enclaveRegistry) public virtual initializer {
        _initialize(anOwner, _enclaveRegistry);
    }

    function _initialize(address anOwner, address _enclaveRegistry) internal virtual {
        owner = anOwner;
        enclaveRegistry = _enclaveRegistry;
        smartBalanceEnabled = true;
        emit SmartAccountInitialized(owner);
    }

    // Require the function call went through EntryPoint or owner
    function _requireFromEntryPointOrOwner() internal view {
        require(msg.sender == address(entryPoint()) || msg.sender == owner, "account: not Owner or EntryPoint");
    }

    // Require the function call went through Owner or guardian
    function _requireFromOwnerOrGaurdian() internal view {
        require(
            msg.sender == owner || msg.sender == address(this),
            "account: Not Owner ot guardian"
        );
    }

    /// implement template method of BaseAccount
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        // Decode the validation mode and actual signature from userOp.signature
        (address validator, bytes memory actualSignature) = abi.decode(userOp.signature, (address, bytes));

        // Check if module is enabled
        require(
            EnclaveModuleManager(EnclaveRegistry(enclaveRegistry).getRegistryAddress("moduleManager")).isModuleEnabled(validator),
            "Module validation failed"
        );

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
        
        // If the call failed or returned invalid data, return validation failed
        if (!success || result.length != 32) {
            return SIG_VALIDATION_FAILED;
        }
        
        // Return the validation result from the validator
        return abi.decode(result, (uint256));
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
    
    /**
     * check current account deposit in the entryPoint
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    /**
     * deposit more funds for this account in the entryPoint
     */
    function addDeposit() public payable {
        entryPoint().depositTo{value: msg.value}(address(this));
    }

    /**
     * withdraw value from the account's deposit
     * @param withdrawAddress target to send to
     * @param amount to withdraw
     */
    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public onlyOwner {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal view override {
        (newImplementation);
        _onlyOwner();
    }

    function setSmartBalanceEnabled(bool _smartBalanceEnabled) external onlyOwner {
        smartBalanceEnabled = _smartBalanceEnabled;
        emit SmartBalanceStatusChanged(_smartBalanceEnabled);
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

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is the zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
