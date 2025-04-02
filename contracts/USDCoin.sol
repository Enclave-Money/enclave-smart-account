// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title USDCoin
 * @dev Implementation of the USD Coin (USDC) token
 * A standard ERC20 token with 6 decimal places
 */
contract USDCoin is ERC20 {
    uint8 private constant _DECIMALS = 6;

    /**
     * @dev Constructor that gives the msg.sender all of existing tokens.
     */
    constructor(uint256 initialSupply) ERC20("USD Coin", "USDC") {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev Override the decimals function to return 6 instead of default 18
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /**
     * @dev Function to mint tokens
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     * @return A boolean that indicates if the operation was successful.
     */
    function mint(address to, uint256 amount) public returns (bool) {
        _mint(to, amount);
        return true;
    }

    /**
     * @dev Function to burn tokens
     * @param from The address from which to burn tokens
     * @param amount The amount of tokens to burn.
     * @return A boolean that indicates if the operation was successful.
     */
    function burn(address from, uint256 amount) public returns (bool) {
        _burn(from, amount);
        return true;
    }
} 