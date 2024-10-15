// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "hardhat/console.sol";

contract TestNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    uint256 public mintPrice;
    address public usdc;

    constructor(uint256 _price, address _usdc) ERC721("TestNFT", "TNFT") {
        mintPrice = _price;
        usdc = _usdc;
    }

    function mintNFT(address recipient) public returns (uint256) {
        console.log("Minting NFT");
        console.log("Balance of USDC: ", IERC20(usdc).balanceOf(recipient));
        console.log("Mint price: ", mintPrice);
        // require(IERC20(usdc).balanceOf(recipient) >= mintPrice, "Insufficient balance");
        // console.log("Transferring USDC");
        // require(IERC20(usdc).transferFrom(recipient, address(this), mintPrice), "Transfer failed");
        IERC20(usdc).transferFrom(recipient, address(this), mintPrice);
        console.log("USDC transferred, Minting NFT");
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _mint(recipient, newItemId);
        console.log("NFT minted: ", newItemId);
        return newItemId;
    }
}
