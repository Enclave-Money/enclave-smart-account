// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev A simple vault contract for testing that accepts any deposit amount
 */
contract SimpleVault {
    mapping(address => mapping(address => uint256)) public deposits;
    
    event Deposited(address indexed user, address indexed tokenAddress, uint256 amount);
    
    function deposit(address tokenAddress, uint256 amount) external payable {
        // Accept any deposit amount, even zero
        deposits[msg.sender][tokenAddress] += amount;
        emit Deposited(msg.sender, tokenAddress, amount);
    }
} 