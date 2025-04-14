// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

contract EnclaveRegistry {
    mapping(string => address) private registry;
    mapping(address => bool) public isManager;

    constructor (address _owner) {
        isManager[_owner] = true; // Owner is also a manager by default
    }

    function _onlyManager() internal view {
        require(isManager[msg.sender], "Caller not manager");
    }

    function addManager(address _manager) external {
        _onlyManager();
        require(_manager != address(0), "Registry: Zero address");
        require(!isManager[_manager], "Registry: Already a manager");
        isManager[_manager] = true;
    }

    function removeManager(address _manager) external {
        _onlyManager();
        require(isManager[_manager], "Registry: Not a manager");
        isManager[_manager] = false;
    }

    function updateRegistryAddress(string memory _contractName, address _contractAddress) external {
        _onlyManager();
        require(_contractAddress != address(0), "Registry: Zero address");
        registry[_contractName] = _contractAddress;
    }

    function getRegistryAddress(string memory _contractName) public view returns (address) {
        require(registry[_contractName] != address(0), "Registry: Entry doesn't exist");
        return registry[_contractName];
    }
}
