// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CrossNetworkReclaimEncoding {
    // Structure to hold decoded repayment data
    struct Repayment {
        uint256 chainId;    // Changed to uint256 for maximum compatibility
        address tokenAddress;
        uint256 amount;
    }

    /**
     * @dev Encodes multiple repayment entries into a single bytes array
     * Format per entry: [32 bytes chainId][32 bytes amount][32 bytes tokenAddress]
     * @param chainIds Array of chain IDs (full uint256)
     * @param amounts Array of repayment amounts (full uint256)
     * @param tokenAddresses Array of token addresses (full uint256)
     * @return bytes Encoded repayment data
     */
    function encode(uint256[] memory chainIds, address[] memory tokenAddresses, uint256[] memory amounts) external pure returns (bytes memory) {
        require(chainIds.length == amounts.length, "Array lengths must match");
        require(chainIds.length == tokenAddresses.length, "Array lengths must match for tokenAddresses");
        require(chainIds.length > 0, "At least one repayment required");
        
        // Use abi.encode to encode the data
        return abi.encode(chainIds, tokenAddresses, amounts);
    }
    
    /**
     * @dev Decodes bytes array back into repayment structures
     * @param data Encoded repayment data
     * @return Repayment[] Array of decoded repayment structures
     */
    function decode(bytes memory data) external pure returns (Repayment[] memory) {
        // Use abi.decode to decode the data
        (uint256[] memory chainIds, address[] memory tokenAddresses, uint256[] memory amounts) = abi.decode(data, (uint256[], address[], uint256[]));
        
        uint256 numRepayments = chainIds.length;
        Repayment[] memory repayments = new Repayment[](numRepayments);
        
        for (uint256 i = 0; i < numRepayments; i++) {
            repayments[i] = Repayment(chainIds[i], tokenAddresses[i], amounts[i]);
        }
        
        return repayments;
    }
}