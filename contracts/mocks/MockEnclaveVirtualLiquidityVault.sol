// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MockEnclaveVirtualLiquidityVault
 * @notice Mock contract for testing various components that interact with the EnclaveVirtualLiquidityVault
 */
contract MockEnclaveVirtualLiquidityVault {
    address constant public NATIVE_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    bool public withdrawSuccess = true;
    mapping(address => uint256) public vaultLiquidity;

    /**
     * @notice Sets whether withdrawToken will succeed or fail
     * @param _success Whether withdrawals should succeed
     */
    function setWithdrawSuccess(bool _success) external {
        withdrawSuccess = _success;
    }
    
    /**
     * @notice Sets vault liquidity for a specific token
     * @param token The token address
     * @param amount The amount to report
     */
    function setVaultLiquidity(address token, uint256 amount) external {
        vaultLiquidity[token] = amount;
    }
    
    /**
     * @notice Gets the vault liquidity for a specific token
     * @param token The token address
     * @return The available liquidity amount
     */
    function getVaultLiquidity(address token) external view returns (uint256) {
        return vaultLiquidity[token];
    }

    /**
     * @notice Mock implementation of withdrawToken
     * @param _tokenAddress The token address
     * @param _amount The amount to withdraw
     * @return Success indicator
     */
    function withdrawToken(address _tokenAddress, uint256 _amount) external returns (bool) {
        if (!withdrawSuccess) {
            revert("Withdrawal failed");
        }
        
        if (_tokenAddress == NATIVE_ADDRESS) {
            (bool success, ) = msg.sender.call{value: _amount}("");
            return success;
        }
        
        return true;
    }

    /**
     * @notice Allows the contract to receive native tokens
     */
    receive() external payable {}
} 