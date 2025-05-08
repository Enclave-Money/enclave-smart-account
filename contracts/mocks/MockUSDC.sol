// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing purposes
 */
contract MockUSDC is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    /**
     * @dev Mints tokens to an address
     * @param to address The address that will receive the minted tokens
     * @param amount uint256 The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @dev Burns tokens from an address
     * @param from address The address from which tokens will be burned
     * @param amount uint256 The amount of tokens to burn
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
} 