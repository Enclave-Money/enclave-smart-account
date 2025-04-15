// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DummyContract
 * @notice A simple upgradeable contract for CREATE3 deployment testing
 * @dev Simplified implementation without OpenZeppelin dependencies
 */
contract DummyContract {
    // Storage variables
    uint256 public exampleArg;
    string public message;
    address public owner;
    bool private _initialized;
    
    // Events
    event ExampleArgChanged(uint256 oldValue, uint256 newValue);
    event MessageChanged(string oldMessage, string newMessage);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    /**
     * @dev Modifier to make a function callable only by the owner
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    /**
     * @dev Modifier to prevent reinitialization
     */
    modifier initializer() {
        require(!_initialized, "Already initialized");
        _;
        _initialized = true;
    }
    
    /**
     * @notice Initializes the contract with an example argument
     * @param _exampleArg Initial value for the example argument
     */
    function initialize(uint256 _exampleArg) public initializer {
        owner = msg.sender;
        exampleArg = _exampleArg;
        message = "DummyContract initialized";
        
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    /**
     * @notice Updates the example argument value
     * @param _newValue New value for the example argument
     */
    function updateExampleArg(uint256 _newValue) public onlyOwner {
        uint256 oldValue = exampleArg;
        exampleArg = _newValue;
        emit ExampleArgChanged(oldValue, _newValue);
    }
    
    /**
     * @notice Updates the message
     * @param _newMessage New message
     */
    function updateMessage(string memory _newMessage) public onlyOwner {
        string memory oldMessage = message;
        message = _newMessage;
        emit MessageChanged(oldMessage, _newMessage);
    }
    
    /**
     * @notice Returns the current state of the contract
     * @return The example argument and message
     */
    function getState() public view returns (uint256, string memory) {
        return (exampleArg, message);
    }
    
    /**
     * @notice Transfers ownership of the contract to a new account
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    /**
     * @notice Authorizes an upgrade to a new implementation
     * @dev Only the owner can authorize upgrades
     * @param newImplementation The address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal virtual onlyOwner {
        // Authorization logic - only owner can upgrade (handled by onlyOwner modifier)
    }
    
    /**
     * @notice Function to upgrade to a new implementation
     * @dev This would be called via the proxy
     * @param newImplementation The address of the new implementation
     */
    function upgradeTo(address newImplementation) external onlyOwner {
        _authorizeUpgrade(newImplementation);
        // The actual upgrade happens in the proxy
    }
} 