// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CrossNetworkReclaimEncoding {
    // Structure to hold decoded repayment data
    struct Repayment {
        uint256 chainId;    // Changed to uint256 for maximum compatibility
        uint256 amount;
    }

    /**
     * @dev Encodes multiple repayment entries into a single bytes array
     * Format per entry: [32 bytes chainId][32 bytes amount]
     * @param chainIds Array of chain IDs (full uint256)
     * @param amounts Array of repayment amounts (full uint256)
     * @return bytes Encoded repayment data
     */
    function encode(uint256[] memory chainIds, uint256[] memory amounts) external pure returns (bytes memory) {
        require(chainIds.length == amounts.length, "Array lengths must match");
        require(chainIds.length > 0, "At least one repayment required");
        
        // Each entry is 64 bytes: 32 for chainId + 32 for amount
        bytes memory result = new bytes(chainIds.length * 64);
        uint256 pointer = 0;
        
        for (uint256 i = 0; i < chainIds.length; i++) {
            // Store chain ID (32 bytes)
            bytes32 chainIdBytes = bytes32(chainIds[i]);
            for (uint256 j = 0; j < 32; j++) {
                result[pointer + j] = chainIdBytes[j];
            }
            pointer += 32;
            
            // Store amount (32 bytes)
            bytes32 amountBytes = bytes32(amounts[i]);
            for (uint256 j = 0; j < 32; j++) {
                result[pointer + j] = amountBytes[j];
            }
            pointer += 32;
        }
        
        return result;
    }
    
    /**
     * @dev Decodes bytes array back into repayment structures
     * @param data Encoded repayment data
     * @return Repayment[] Array of decoded repayment structures
     */
    function decode(bytes memory data) external pure returns (Repayment[] memory) {
        require(data.length % 64 == 0, "Invalid data length");
        
        uint256 numRepayments = data.length / 64;
        Repayment[] memory repayments = new Repayment[](numRepayments);
        
        for (uint256 i = 0; i < numRepayments; i++) {
            uint256 pointer = i * 64;
            
            // Extract chain ID (first 32 bytes)
            bytes32 chainIdBytes;
            for (uint256 j = 0; j < 32; j++) {
                chainIdBytes |= bytes32(data[pointer + j] & 0xFF) >> (j * 8);
            }
            uint256 chainId = uint256(chainIdBytes);
            
            // Extract amount (next 32 bytes)
            bytes32 amountBytes;
            for (uint256 j = 0; j < 32; j++) {
                amountBytes |= bytes32(data[pointer + 32 + j] & 0xFF) >> (j * 8);
            }
            uint256 amount = uint256(amountBytes);
            
            repayments[i] = Repayment(chainId, amount);
        }
        
        return repayments;
    }
}