// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract EnclaveLPTokenMap is Ownable {
    // Mapping from ERC20 token address to EnclaveLPToken address
    mapping(address => address) private tokenToEnclaveLPToken;

    // Event to log the mapping of a new token
    event TokenMapped(address indexed erc20Token, address indexed enclaveLPToken);

    // Function to map an ERC20 token to an EnclaveLPToken
    function mapToken(address erc20Token, address enclaveLPToken) external onlyOwner {
        require(erc20Token != address(0), "ERC20 token address cannot be zero");
        require(enclaveLPToken != address(0), "EnclaveLPToken address cannot be zero");
        require(tokenToEnclaveLPToken[erc20Token] == address(0), "Token already mapped");

        tokenToEnclaveLPToken[erc20Token] = enclaveLPToken;
        emit TokenMapped(erc20Token, enclaveLPToken);
    }

    // Function to get the EnclaveLPToken address for a given ERC20 token
    function getEnclaveLPToken(address erc20Token) external view returns (address) {
        return tokenToEnclaveLPToken[erc20Token];
    }
}