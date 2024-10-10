// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./IEnclaveNFTGasLogic.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract NFTGasLogic is IEnclaveNFTGasLogic {
    // Mapping to store sponsored transaction count and total amount for each address
    mapping(address => mapping(address => SponsoredData)) private sponsoredTransactionsByNFT;

    mapping(address => uint256) public transactionLimitByNFT;
    mapping(address => uint256) public gasValueLimitByNFT;

    // Struct to hold sponsored transaction data
    struct SponsoredData {
        uint256 count;
        uint256 totalAmount;
    }

    constructor() {
    }

    function isEligible(address user, address nft, uint256 gasAmount) public view override returns (bool) {
        return  IERC721(nft).balanceOf(user) > 0 &&
                sponsoredTransactionsByNFT[nft][user].count < transactionLimitByNFT[nft] && 
                gasAmount + sponsoredTransactionsByNFT[nft][user].totalAmount <= gasValueLimitByNFT[nft];
    }

    function applyLogic(address user, address nft, uint256 gasAmount) external override returns (bool) {
        require(isEligible(user, nft, gasAmount), "Not eligible for sponsorship");
        sponsoredTransactionsByNFT[nft][user].count++;
        sponsoredTransactionsByNFT[nft][user].totalAmount += gasAmount;
        return true;
    }

    // Additional function for updating limits (can be restricted to admin/owner in a real implementation)
    function addOrUpdateNFTLimits(address nft, uint256 transactionLimit, uint256 gasValueLimit) public {
        transactionLimitByNFT[nft] = transactionLimit;
        gasValueLimitByNFT[nft] = gasValueLimit;
    }
}
