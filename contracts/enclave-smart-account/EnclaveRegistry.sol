// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

contract EnclaveRegistry {

    address public owner;
    mapping(string => address) private registry;

    constructor (address _owner) {
        owner = _owner;
    }

    function _onlyOwner () internal view {
        require(msg.sender == owner, "Caller not owner");
    }

    function updateRegistryAddress(string memory _contractName, address _contractAddress) external {
        _onlyOwner();
        require(_contractAddress != address(0), "Registry: Zero address");
        registry[_contractName] = _contractAddress;
    }

    function getRegistryAddress(string memory _contractName) public view returns (address) {
        require(registry[_contractName] != address(0), "Registry: Entry doesn't exist");
        return registry[_contractName];
    }
}
