// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

contract EnclaveRegistryV0 {
    mapping(bytes32 => address) private registry;
    mapping(address => bool) public isManager;
    uint256 private managerCount;

    // Events
    event ManagerAdded(address indexed manager);
    event ManagerRemoved(address indexed manager);
    event RegistryUpdated(
        bytes32 indexed contractName,
        address indexed contractAddress
    );

    // Custom errors
    error CallerNotManager();
    error ZeroAddress();
    error AlreadyManager();
    error NotManager();
    error CannotRemoveLastManager();

    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        isManager[_owner] = true; // Owner is also a manager by default
        managerCount = 1;

        emit ManagerAdded(_owner);
    }

    modifier _onlyManager() {
        if (!isManager[msg.sender]) revert CallerNotManager();
        _;
    }

    function addManager(address _manager) external _onlyManager {
        if (_manager == address(0)) revert ZeroAddress();
        if (isManager[_manager]) revert AlreadyManager();

        isManager[_manager] = true;
        managerCount++;

        emit ManagerAdded(_manager);
    }

    function removeManager(address _manager) external _onlyManager {
        if (!isManager[_manager]) revert NotManager();
        if (managerCount <= 1) revert CannotRemoveLastManager();

        isManager[_manager] = false;
        managerCount--;

        emit ManagerRemoved(_manager);
    }

    function updateRegistryAddress(
        bytes32 _contractName,
        address _contractAddress
    ) external _onlyManager {
        registry[_contractName] = _contractAddress;
        
        emit RegistryUpdated(_contractName, _contractAddress);
    }

    function getRegistryAddress(
        bytes32 _contractName
    ) public view returns (address) {
        return registry[_contractName];
    }
}
