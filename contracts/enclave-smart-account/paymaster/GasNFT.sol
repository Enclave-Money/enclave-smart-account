// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract GasNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    uint256 public mintPrice;

    constructor() ERC721("GasNFT", "GNFT") {}

    function setMintPrice(uint256 _price) public onlyOwner {
        mintPrice = _price;
    }

    function mintNFT(address recipient) public returns (uint256) {
        require(balanceOf(recipient) == 0, "GasNFT: Already minted");
        // require(msg.value >= mintPrice, "GasNFT: Insufficient funds");
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _mint(recipient, newItemId);
        return newItemId;
    }
}
