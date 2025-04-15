// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

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
    
    /**
     * @notice Constructor that sets the implementation and initializes it
     * @param _implementation The address of the implementation contract
     * @param _data The initialization data to forward to the implementation
     */
    constructor(address _implementation, bytes memory _data) {
        _setImplementation(_implementation);
        
        // Initialize implementation if data is provided
        if (_data.length > 0) {
            (bool success, ) = _implementation.delegatecall(_data);
            require(success, "Initialization failed");
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
        require(msg.sender == address(this), "Only proxy can upgrade");
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
        require(success, "Function call failed");
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
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())
            
            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), _implementation, 0, calldatasize(), 0, 0)
            
            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())
            
            switch result
            // delegatecall returns 0 on error.
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
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
        require(_implementation != address(0), "Invalid implementation");
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, _implementation)
        }
    }
} 