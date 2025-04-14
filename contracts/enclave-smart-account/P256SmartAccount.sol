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
import { Base64URL } from "./utils/Base64URL.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

import "./EnclaveRegistry.sol";
import "./P256V.sol";

import "hardhat/console.sol";

/**
 * minimal account.
 *  this is sample minimal account.
 *  has execute, eth handling methods
 *  has a single signer that can send requests through the entryPoint.
 */
contract P256SmartAccount is
    BaseAccount,
    UUPSUpgradeable,
    Initializable,
    IERC1271
{
    using ECDSA for bytes32;

    address[] public guardians;
    mapping(address => bool) public isGuardian;

    address public enclaveRegistry;
    uint256[2] public pubKey;

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
        require(
            msg.sender == address(this),
            "only owner"
        );
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
    ) external {
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

    /**
     * @dev The _entryPoint member is immutable, to reduce gas consumption.  To upgrade EntryPoint,
     * a new implementation of SimpleAccount must be deployed with the new EntryPoint address, then upgrading
     * the implementation by calling `upgradeTo()`
     */
    function initialize(
        uint256[2] memory _pubKey,
        address _enclaveRegistry
    ) public virtual initializer {
        _initialize( _pubKey, _enclaveRegistry);
    }

    function _initialize(
        uint256[2] memory _pubKey,
        address _enclaveRegistry
    ) internal virtual {
        enclaveRegistry = _enclaveRegistry;
        pubKey = _pubKey;
    }

    // Require the function call went through EntryPoint or owner
    function _requireFromEntryPointOrOwner() internal view {
        require(
            msg.sender == address(entryPoint()) || msg.sender == address(this),
            "account: not Owner or EntryPoint"
        );
    }

    // Require the function call went through Owner or guardian
    function _requireFromOwnerOrGuardian() internal view {
        require(
                msg.sender == address(this) ||
                isGuardian[msg.sender],
            "account: Not Owner ot guardian"
        );
    }

    // implement template method of BaseAccount
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        (
            bytes32 keyHash,
            uint256 r,
            uint256 s,
            bytes memory authenticatorData,
            string memory clientDataJSONPre,
            string memory clientDataJSONPost
        ) = abi.decode(
            userOp.signature,
            (bytes32, uint256, uint256, bytes, string, string)
        );
        (keyHash);

        console.log("r", r);
        console.log("s", s);
        console.log("clientDataJSONPre", clientDataJSONPre);
        console.log("clientDataJSONPost", clientDataJSONPost);

        if (!_verifySignature(authenticatorData, clientDataJSONPre, clientDataJSONPost, userOpHash, r, s)) {
            console.log("Validation Failed");
            return SIG_VALIDATION_FAILED;
        }

        console.log("Validation Success");
        return 0;
    }

    /**
     * @dev Should return whether the signature provided is valid for the provided data
     * @param _hash      Hash of the data to be signed
     * @param _signature Signature byte array associated with _hash
     *
     * MUST return the bytes4 magic value 0x1626ba7e when function passes.
     * MUST NOT modify state (using STATICCALL for solc < 0.5, view modifier for solc > 0.5)
     * MUST allow external calls
     */
    function isValidSignature(
        bytes32 _hash,
        bytes memory _signature
    ) public view override returns (bytes4 magicValue) {
        (
            bytes32 keyHash,
            uint256 r,
            uint256 s,
            bytes memory authenticatorData,
            string memory clientDataJSONPre,
            string memory clientDataJSONPost
        ) = abi.decode(
            _signature,
            (bytes32, uint256, uint256, bytes, string, string)
        );

        (keyHash);

        if (_verifySignature(authenticatorData, clientDataJSONPre, clientDataJSONPost, _hash, r, s)) {
            return 0x1626ba7e; // Magic value for EIP-1271
        } else {
            return 0xffffffff; // Failure
        }
    }

    function _verifySignature(
        bytes memory authenticatorData,
        string memory clientDataJSONPre,
        string memory clientDataJSONPost,
        bytes32 userOpHash,
        uint256 r,
        uint256 s
    ) internal view returns (bool) {
        string memory opHashBase64 = Base64URL.encode(
            bytes.concat(userOpHash)
        );

        string memory clientDataJSON = string.concat(
            clientDataJSONPre,
            opHashBase64,
            clientDataJSONPost
        );

        bytes32 clientHash = sha256(bytes(clientDataJSON));
        bytes32 sigHash = sha256(bytes.concat(authenticatorData, clientHash));

        return P256V(EnclaveRegistry(enclaveRegistry).getRegistryAddress("p256Verifier"))
            .verify(sigHash, r, s, pubKey);
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
     *  addguardian function, Adds new guardian to the smartAccount, called by Owner
     * @param _guardian  address of the guardian account
     */
    function addGuardian(address _guardian) external onlyOwner {
        require(
            _guardian != address(0),
            "account: guardian address should be NonZero"
        );
        require(!isGuardian[_guardian], "account: Guardian already exists");
        isGuardian[_guardian] = true;
    }

    /**
     * removeguardian function, removes guardian to the smartAccount, Called by Owner
     */
    function removeGuardian(address _guardian) external onlyOwner {
        // Remove guardian from list
        require(isGuardian[_guardian], "account: Guardian does not exist");
        isGuardian[_guardian] = false;
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == _guardian) {
                guardians[i] = guardians[guardians.length - 1];
                guardians.pop();
                break;
            }
        }
    }

    /**
     * transferOwnership, transferring ownership of the account, Called by Owner or guardian
     * @param _newPubKey address of the newOwner
     */
    function transferOwnership(uint256[2] memory _newPubKey) external {
        _requireFromOwnerOrGuardian();
        pubKey = _newPubKey;
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
    ) public onlyOwner {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view override {
        (newImplementation);
        _requireFromOwnerOrGuardian();
    }

    /**
     * @dev Returns the number of guardians for this account.
     * @return The count of guardians.
     */
    function getGuardianCount() public view returns (uint256) {
        return guardians.length;
    }
}
