// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TwitterVault is Ownable {
    using SafeERC20 for IERC20;
    
    // Event to emit when a withdrawal occurs
    event TokenWithdrawn(address token, address to, uint256 amount);

    constructor() Ownable () {}

    /**
     * @notice Allows the owner to withdraw a specified amount of ERC20 tokens
     * @param token The address of the ERC20 token to withdraw
     * @param to The address to send the tokens to
     * @param amount The amount of tokens to withdraw
     */
    function withdrawToken(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");

        IERC20 tokenContract = IERC20(token);
        require(
            tokenContract.balanceOf(address(this)) >= amount,
            "Insufficient balance"
        );

        tokenContract.safeTransfer(to, amount);

        emit TokenWithdrawn(token, to, amount);
    }
}
