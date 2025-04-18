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

import "../../EnclaveRegistryV0.sol";
import "../EnclaveModuleManager.sol";

// Custom errors
error NotOwnerOrAccount();
error NotOwnerOrEntryPoint();
error NotOwnerOrGuardian();
error ModuleValidationFailed();
error InvalidArrayLengths();
error ZeroAddressNotAllowed();
error SmartBalanceDisabled();
error NotAuthorizedCaller();
error ExternalCallFailed();
error ZeroBalance();

bytes32 constant ENTRYPOINT = keccak256(abi.encodePacked("entryPoint"));
bytes32 constant SMART_BALANCE_CONVERSION_MANAGER = keccak256(
    abi.encodePacked("smartBalanceConversionManager")
);
bytes32 constant SMART_BALANCE_VAULT = keccak256(
    abi.encodePacked("smartBalanceVault")
);
bytes32 constant MODULE_MANAGER = keccak256(abi.encodePacked("moduleManager"));

interface IEnclaveVirtualLiquidityVault {
    function deposit(address tokenAddress, uint256 amount) external payable;
}

/**
 * @dev ERC-7201 storage layout namespace
 * @custom:storage-location erc7201:enclave.storage.SmartAccountV1
 */
library SmartAccountV1Storage {
    struct SmartAccountV1Layout {
        address owner;
        address enclaveRegistry;
        bool smartBalanceEnabled;
    }

    // keccak256(abi.encode(uint256(keccak256("enclave.storage.SmartAccountV1")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_SLOT =
        keccak256(
            abi.encode(uint256(keccak256("enclave.storage.SmartAccountV1")) - 1)
        ) & ~bytes32(uint256(0xff));

    function smartAccountV1Layout()
        internal
        pure
        returns (SmartAccountV1Layout storage l)
    {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

/**
 * minimal account.
 *  this is sample minimal account.
 *  has execute, eth handling methods
 *  has a single signer that can send requests through the entryPoint.
 */
contract SmartAccountV1 is
    BaseAccount,
    TokenCallbackHandler,
    UUPSUpgradeable,
    Initializable
{
    using ECDSA for bytes32;

    modifier _onlyOwner() {
        if (msg.sender != owner() && msg.sender != address(this))
            revert NotOwnerOrAccount();
        _;
    }

    modifier _onlySmartBalanceConversionManager() {
        if (
            msg.sender != address(this) &&
            msg.sender !=
            EnclaveRegistryV0(enclaveRegistry()).getRegistryAddress(
                SMART_BALANCE_CONVERSION_MANAGER
            )
        ) revert NotAuthorizedCaller();
        _;
    }

    // Require the function call went through EntryPoint or owner
    modifier _requireFromEntryPointOrOwner() {
        if (msg.sender != address(entryPoint()) && msg.sender != owner())
            revert NotOwnerOrEntryPoint();
        _;
    }

    function owner() public view returns (address) {
        return SmartAccountV1Storage.smartAccountV1Layout().owner;
    }

    function enclaveRegistry() public view returns (address) {
        return SmartAccountV1Storage.smartAccountV1Layout().enclaveRegistry;
    }

    function smartBalanceEnabled() public view returns (bool) {
        return SmartAccountV1Storage.smartAccountV1Layout().smartBalanceEnabled;
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        address _entryPoint = EnclaveRegistryV0(enclaveRegistry())
            .getRegistryAddress(ENTRYPOINT);
        return IEntryPoint(_entryPoint);
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    constructor() {
        _disableInitializers();
    }

    /**
     * execute a transaction (called directly from owner, or by entryPoint)
     * @param dest destination address to call
     * @param value the value to pass in this call
     * @param func the calldata to pass in this call
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external _requireFromEntryPointOrOwner {
        _call(dest, value, func);
    }

    /**
     * execute a sequence of transactions
     * @dev to reduce gas consumption for trivial case (no value), use a zero-length array to mean zero value
     * @param dest an array of destination addresses
     * @param value an array of values to pass to each call. can be zero-length for no-value calls
     * @param func an array of calldata to pass to each call
     */
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external _requireFromEntryPointOrOwner {
        uint256 destLength = dest.length;
        uint256 valueLength = value.length;
        uint256 funcLength = func.length;

        if (
            destLength != funcLength ||
            (valueLength != 0 && valueLength != funcLength)
        ) revert InvalidArrayLengths();

        if (valueLength == 0) {
            for (uint256 i = 0; i < destLength; i++) {
                _call(dest[i], 0, func[i]);
            }
        } else {
            for (uint256 i = 0; i < destLength; i++) {
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
    function initialize(
        address anOwner,
        address _enclaveRegistry,
        bool _smartBalanceEnabled
    ) public virtual initializer {
        _initialize(anOwner, _enclaveRegistry, _smartBalanceEnabled);
    }

    function _initialize(
        address anOwner,
        address _enclaveRegistry,
        bool _smartBalanceEnabled
    ) internal virtual {
        SmartAccountV1Storage.smartAccountV1Layout().owner = anOwner;
        SmartAccountV1Storage
            .smartAccountV1Layout()
            .enclaveRegistry = _enclaveRegistry;
        SmartAccountV1Storage.smartAccountV1Layout().smartBalanceEnabled = _smartBalanceEnabled;
    }

    /// implement template method of BaseAccount
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        // Decode the validation mode and actual signature from userOp.signature
        (address validator, bytes memory actualSignature) = abi.decode(
            userOp.signature,
            (address, bytes)
        );

        // Check if module is enabled
        if (
            !EnclaveModuleManager(
                EnclaveRegistryV0(enclaveRegistry()).getRegistryAddress(
                    MODULE_MANAGER
                )
            ).isModuleEnabled(validator)
        ) revert ModuleValidationFailed();

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
    function withdrawDepositTo(
        address payable withdrawAddress,
        uint256 amount
    ) public _onlyOwner {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view override _onlyOwner {}

    function setSmartBalanceEnabled(
        bool _smartBalanceEnabled
    ) external _onlyOwner {
        SmartAccountV1Storage
            .smartAccountV1Layout()
            .smartBalanceEnabled = _smartBalanceEnabled;
    }

    function smartBalanceConvert(
        address tokenAddress
    ) external _onlySmartBalanceConversionManager {
        if (!smartBalanceEnabled()) revert SmartBalanceDisabled();
        if (tokenAddress == address(0)) revert ZeroAddressNotAllowed();

        IERC20 smartBalanceToken = IERC20(tokenAddress);
        IEnclaveVirtualLiquidityVault vault = IEnclaveVirtualLiquidityVault(
            EnclaveRegistryV0(enclaveRegistry()).getRegistryAddress(
                SMART_BALANCE_VAULT
            )
        );
        uint256 balance = smartBalanceToken.balanceOf(address(this));
        
        // Check for zero balance
        if (balance == 0) revert ZeroBalance();

        smartBalanceToken.approve(address(vault), balance);
        vault.deposit(tokenAddress, balance);
    }

    function transferOwnership(address newOwner) external _onlyOwner {
        if (newOwner == address(0)) revert ZeroAddressNotAllowed();
        SmartAccountV1Storage.smartAccountV1Layout().owner = newOwner;
    }
}
