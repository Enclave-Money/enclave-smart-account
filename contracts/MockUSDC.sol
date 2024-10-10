// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract MockUSDC is ERC20 {
    constructor (string memory _name, string memory _symbol) ERC20 (_name, _symbol) {}

    function mint (address _account, uint256 _value) public {
        _mint(_account, _value);
    }

    function burn (address _account, uint256 _value) public {
        _burn(_account, _value);
    }
}