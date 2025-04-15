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
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

import "../EnclaveRegistry.sol";
import "./EnclaveModuleManager.sol";

interface IEnclaveVirtualLiquidityVault {
    function deposit(address tokenAddress, uint256 amount) external payable;
}

import "hardhat/console.sol";

/**
 * @dev ERC-7201 storage layout namespace
 * @custom:storage-location erc7201:enclave.storage.P256SmartAccountV1
 */
library P256SmartAccountV1Storage {
    struct P256SmartAccountV1Layout {
        bool smartBalanceEnabled;
        address enclaveRegistry;
        uint256[2] pubKey;
    }

    bytes32 private constant STORAGE_SLOT = keccak256(abi.encode(keccak256("enclave.storage.P256SmartAccountV1"))) & bytes32(type(uint256).max - 0xFF);

    function p256SmartAccountLayoutV1() internal pure returns (P256SmartAccountV1Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

contract P256SmartAccountV1 is
    BaseAccount,
    UUPSUpgradeable,
    Initializable,
    IERC1271
{
    using ECDSA for bytes32;

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier onlySmartBalanceConversionManager() {
        require(
            msg.sender == address(this) ||
            msg.sender == EnclaveRegistry(enclaveRegistry()).getRegistryAddress("smartBalanceConversionManager"),
            "Convert: Invalid caller"
        );
        _;
    }

    function smartBalanceEnabled() public view returns (bool) {
        return P256SmartAccountV1Storage.p256SmartAccountLayoutV1().smartBalanceEnabled;
    }

    function enclaveRegistry() public view returns (address) {
        return P256SmartAccountV1Storage.p256SmartAccountLayoutV1().enclaveRegistry;
    }

    function pubKey(uint _index) public view returns (uint256) {
        return P256SmartAccountV1Storage.p256SmartAccountLayoutV1().pubKey[_index];
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        address _entryPoint = EnclaveRegistry(enclaveRegistry())
            .getRegistryAddress("entryPoint");
        return IEntryPoint(_entryPoint);
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    constructor() {
        _disableInitializers();
    }

    function _onlyOwner() internal view {
        require(
            msg.sender == address(this),
            "only owner"
        );
    }

    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromEntryPointOrOwner();
        _call(dest, value, func);
    }

    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external {
        _requireFromEntryPointOrOwner();
        require(
            dest.length == func.length &&
                (value.length == 0 || value.length == func.length),
            "wrong array lengths"
        );
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

    function initialize(
        uint256[2] memory _pubKey,
        address _enclaveRegistry,
        bool _smartBalanceEnabled
    ) public virtual initializer {
        _initialize(_pubKey, _enclaveRegistry, _smartBalanceEnabled);
    }

    function _initialize(
        uint256[2] memory _pubKey,
        address _enclaveRegistry,
        bool _smartBalanceEnabled
    ) internal virtual {
        P256SmartAccountV1Storage.p256SmartAccountLayoutV1().enclaveRegistry = _enclaveRegistry;
        P256SmartAccountV1Storage.p256SmartAccountLayoutV1().pubKey = _pubKey;
        P256SmartAccountV1Storage.p256SmartAccountLayoutV1().smartBalanceEnabled = _smartBalanceEnabled;
    }

    function _requireFromEntryPointOrOwner() internal view {
        require(
            msg.sender == address(entryPoint()) || msg.sender == address(this),
            "account: not Owner or EntryPoint"
        );
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        // Decode the validator address and actual signature from userOp.signature
        (address validator, bytes memory actualSignature) = abi.decode(userOp.signature, (address, bytes));

        // Check if module is enabled
        require(
            EnclaveModuleManager(EnclaveRegistry(enclaveRegistry()).getRegistryAddress("moduleManager")).isModuleEnabled(validator),
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

        console.log("Success: ", success);

        uint256 res = abi.decode(result, (uint256));
        console.log("Result: ", res);
        
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

    function setSmartBalanceEnabled(bool _smartBalanceEnabled) external onlyOwner {
        P256SmartAccountV1Storage.p256SmartAccountLayoutV1().smartBalanceEnabled = _smartBalanceEnabled;
    }
    
    function smartBalanceConvert(address tokenAddress) external onlySmartBalanceConversionManager {
        require(smartBalanceEnabled(), "Convert: Smart balance not enabled");

        IEnclaveVirtualLiquidityVault vault = IEnclaveVirtualLiquidityVault(EnclaveRegistry(enclaveRegistry()).getRegistryAddress("smartBalanceVault"));
        
        if (tokenAddress == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)) {
            // For native token (ETH), send the entire balance
            uint256 balance = address(this).balance;
            require(balance > 0, "No native token balance to convert");
            vault.deposit{value: balance}(tokenAddress, balance);
        } else {
            // For ERC20 tokens
            IERC20 token = IERC20(tokenAddress);
            uint256 balance = token.balanceOf(address(this));
            require(balance > 0, "No token balance to convert");
            
            token.approve(address(vault), balance);
            vault.deposit(tokenAddress, balance);
        }
    }

    function _authorizeUpgrade(address newImplementation) internal view override {
        (newImplementation);
        _requireFromEntryPointOrOwner();
    }

    /**
     * @dev Implementation of ERC1271's isValidSignature
     * @param hash The hash of the data being signed
     * @param signature The signature to validate
     * @return The magic value if the signature is valid, 0xffffffff otherwise
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        // Decode the validator address and actual signature
        (address validator, bytes memory actualSignature) = abi.decode(signature, (address, bytes));

        // Check if module is enabled
        if (!EnclaveModuleManager(EnclaveRegistry(enclaveRegistry()).getRegistryAddress("moduleManager")).isModuleEnabled(validator)) {
            return 0xffffffff;
        }

        // Call the validator's isValidSignature function
        (bool success, bytes memory result) = validator.staticcall(
            abi.encodeWithSignature(
                "isValidSignatureWithSender(address,bytes32,bytes)",
                address(this),
                hash,
                actualSignature
            )
        );

        // If the call failed or returned invalid data, return invalid signature
        if (!success || result.length != 32) {
            return 0xffffffff;
        }

        // If the validator returned the magic value, return it
        return abi.decode(result, (bytes4));
    }
}
