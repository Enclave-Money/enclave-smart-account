// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract OdysseyNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    IERC20 public usdc;
    uint256 public constant MINT_PRICE = 250 * 10**18;

    constructor(address _usdc) ERC721("OdysseyNFT", "ONFT") {
        usdc = IERC20(_usdc);
    }

    function mintNFT(address recipient) public returns (uint256) {
        require(usdc.transferFrom(msg.sender, address(this), MINT_PRICE), "USDC transfer failed");
        
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _mint(recipient, newItemId);
        return newItemId;
    }
}
