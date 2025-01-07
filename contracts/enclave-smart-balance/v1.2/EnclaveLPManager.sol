// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./EnclaveLPTokenContracts/EnclaveLPToken.sol";

contract EnclaveLPManager {
    mapping(address => address) public lpTokenContracts; // Mapping from token address to EnclaveLPToken contract address

    event Staked(address indexed user, address indexed tokenAddress, uint256 amount);

    function setXERC20Contract(address tokenAddress, address lpTokenAddress) external {
        // This function allows setting the corresponding EnclaveLPToken contract for a token
        lpTokenContracts[tokenAddress] = lpTokenAddress;
    }

    function stake(address tokenAddress, uint256 amount) external {
        require(tokenAddress != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");

        // Transfer the specified amount of tokens from the user to this contract
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);

        // Get the corresponding EnclaveLPToken contract
        address lpTokenAddress = lpTokenContracts[tokenAddress];
        require(lpTokenAddress != address(0), "EnclaveLPToken contract not set for this token");

        // Mint EnclaveLPToken tokens to the user
        EnclaveLPToken(lpTokenAddress).mint(msg.sender, amount);

        emit Staked(msg.sender, tokenAddress, amount);
    }
}
