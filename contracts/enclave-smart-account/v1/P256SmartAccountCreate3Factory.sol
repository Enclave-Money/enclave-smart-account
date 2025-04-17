// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "../../utils-contracts/CREATE3.sol";
import "./P256SmartAccountV1.sol";

/**
 * @title P256SmartAccountCreate3Factory
 * @notice A factory contract that deploys P256SmartAccountV1 instances using CREATE3
 * @dev Uses CREATE3 library to deploy contracts with deterministic addresses across different chains
 */
contract P256SmartAccountCreate3Factory {
    // Smart Account implementation that will be used as the logic contract
    P256SmartAccountV1 public immutable accountImplementation;
    
    // Event emitted when a new smart account is deployed
    event AccountDeployed(address indexed smartAccount, bytes32 indexed salt, uint256[2] pubKey);
    
    constructor() {
        accountImplementation = new P256SmartAccountV1();
    }
    
    /**
     * @notice Deploys a new P256SmartAccountV1 to a deterministic address using CREATE3
     * @param pubKey Public key components [x, y] for the smart account
     * @param enclaveRegistry Address of the enclave registry
     * @param smartBalanceEnabled Whether smart balance features should be enabled
     * @param salt Unique value to determine the address of the contract
     * @return smartAccount Address of the deployed smart account
     */
    function createAccount(
        uint256[2] calldata pubKey,
        address enclaveRegistry,
        bool smartBalanceEnabled,
        bytes32 salt
    ) external returns (address smartAccount) {
        bytes memory proxyCreationCode = abi.encodePacked(
            type(Create3Proxy).creationCode,
            abi.encode(
                address(accountImplementation), 
                abi.encodeWithSelector(
                    P256SmartAccountV1.initialize.selector,
                    pubKey,
                    enclaveRegistry,
                    smartBalanceEnabled
                )
            )
        );
        
        smartAccount = CREATE3.deploy(salt, proxyCreationCode, 0);
        
        emit AccountDeployed(smartAccount, salt, pubKey);
    }
    
    /**
     * @notice Predicts the address where a smart account will be deployed using CREATE3
     * @param salt Unique value to determine the address
     * @return predicted Address of the smart account that would be deployed
     */
    function predictAccountAddress(bytes32 salt) external view returns (address predicted) {
        return CREATE3.getDeployed(salt);
    }
    
    /**
     * @notice Generates a human-readable salt from a string
     * @param name String to generate salt from
     * @return salt The generated salt
     */
    function generateSalt(string calldata name) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(name));
    }

    /**
     * @notice Creates multiple accounts in a single transaction
     * @param pubKeys Array of public key components for the smart accounts
     * @param enclaveRegistries Array of enclave registry addresses
     * @param smartBalanceEnabled Array of boolean flags for smart balance features
     * @param salts Array of unique values to determine the addresses
     * @return accounts Array of deployed smart account addresses
     */
    function createMultipleAccounts(
        uint256[2][] calldata pubKeys,
        address[] calldata enclaveRegistries,
        bool[] calldata smartBalanceEnabled,
        bytes32[] calldata salts
    ) external returns (address[] memory accounts) {
        uint256 len = pubKeys.length;
        require(len == enclaveRegistries.length && len == smartBalanceEnabled.length && len == salts.length, "Length mismatch");
        
        accounts = new address[](len);
        
        for (uint256 i = 0; i < len; i++) {
            bytes memory proxyCreationCode = abi.encodePacked(
                type(Create3Proxy).creationCode,
                abi.encode(
                    address(accountImplementation), 
                    abi.encodeWithSelector(
                        P256SmartAccountV1.initialize.selector,
                        pubKeys[i],
                        enclaveRegistries[i],
                        smartBalanceEnabled[i]
                    )
                )
            );
            
            accounts[i] = CREATE3.deploy(salts[i], proxyCreationCode, 0);
            
            emit AccountDeployed(accounts[i], salts[i], pubKeys[i]);
        }
    }
}

/**
 * @title Create3Proxy
 * @notice A simple proxy contract for CREATE3 deployments
 * @dev Forwards all calls to the implementation contract
 */
contract Create3Proxy {
    // Storage slot with the address of the current implementation
    // This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    
    // Events
    event Upgraded(address indexed implementation);
    
    // Define custom errors at the top
    error InvalidImplementation();
    error UnauthorizedCaller();
    error InitializationFailed();
    error FunctionCallFailed();
    
    /**
     * @notice Constructor that sets the implementation and initializes it
     * @param _implementation The address of the implementation contract
     * @param _data The initialization data to forward to the implementation
     */
    constructor(address _implementation, bytes memory _data) {
        // Validate implementation address
        if (_implementation == address(0)) revert InvalidImplementation();
        
        _setImplementation(_implementation);
        
        // Initialize implementation if data is provided
        if (_data.length > 0) {
            (bool success, ) = _implementation.delegatecall(_data);
            if (!success) revert InitializationFailed();
        }
    }
    
    /**
     * @notice Fallback function that delegates calls to the implementation
     */
    fallback() external payable {
        _delegate(_getImplementation());
    }
    
    /**
     * @notice Receive function to accept ETH
     */
    receive() external payable {
        _delegate(_getImplementation());
    }
    
    /**
     * @notice Upgrades the implementation address
     * @param _implementation The new implementation address
     */
    function upgradeTo(address _implementation) public {
        if (msg.sender != address(this)) revert UnauthorizedCaller();
        if (_implementation == address(0)) revert InvalidImplementation();
        
        _setImplementation(_implementation);
        emit Upgraded(_implementation);
    }
    
    /**
     * @notice Upgrades the implementation and calls a function on the new implementation
     * @param _implementation The new implementation address
     * @param _data The function call data to forward to the new implementation
     */
    function upgradeToAndCall(address _implementation, bytes calldata _data) external {
        upgradeTo(_implementation);
        
        (bool success, ) = _implementation.delegatecall(_data);
        if (!success) revert FunctionCallFailed();
    }
    
    /**
     * @notice Gets the current implementation address
     * @return The address of the implementation contract
     */
    function implementation() external view returns (address) {
        return _getImplementation();
    }
    
    /**
     * @notice Internal function to delegate the current call to the implementation
     * @param _implementation The address to delegate the call to
     */
    function _delegate(address _implementation) internal {
        assembly {
            // Copy msg.data directly
            calldatacopy(0, 0, calldatasize())
            
            // Define constants once
            let memPos := 0
            let size := calldatasize()
            
            // Use predefined constants
            let result := delegatecall(gas(), _implementation, memPos, size, memPos, 0)
            
            // Use existing variables where possible
            returndatacopy(memPos, 0, returndatasize())
            
            // Simplified switch
            if eq(result, 0) { revert(memPos, returndatasize()) }
            return(memPos, returndatasize())
        }
    }
    
    /**
     * @notice Internal function to retrieve the implementation address
     * @return impl The implementation address
     */
    function _getImplementation() internal view returns (address impl) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            impl := sload(slot)
        }
    }
    
    /**
     * @notice Internal function to store the implementation address
     * @param _implementation The implementation address to store
     */
    function _setImplementation(address _implementation) internal {
        if (_implementation == address(0)) revert InvalidImplementation();
        
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, _implementation)
        }
    }
} 