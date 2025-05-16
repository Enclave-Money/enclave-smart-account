// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockEnclaveVirtualLiquidityVault
 * @notice Mock contract for testing various components that interact with the EnclaveVirtualLiquidityVault
 */
contract MockEnclaveVirtualLiquidityVault {
    using SafeERC20 for IERC20;

    address constant public NATIVE_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    bool public withdrawSuccess = true;
    mapping(address => uint256) public vaultLiquidity;
    mapping(address => bool) public isVaultManager;

    event TokenWithdrawn(address indexed tokenAddress, address indexed vaultManager, uint256 amount);

    constructor() {
        // Initialize the contract deployer as vault manager
        isVaultManager[msg.sender] = true;
    }

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
     * @notice Adds a new vault manager
     * @param _vaultManager The address to add as vault manager
     */
    function addVaultManager(address _vaultManager) external {
        isVaultManager[_vaultManager] = true;
    }

    /**
     * @notice Removes a vault manager
     * @param _vaultManager The address to remove from vault managers
     */
    function removeVaultManager(address _vaultManager) external {
        isVaultManager[_vaultManager] = false;
    }

    /**
     * @notice Mock implementation of withdrawToken
     * @param _tokenAddress The token address
     * @param _amount The amount to withdraw
     */
    function withdrawToken(address _tokenAddress, uint256 _amount) external {
        require(withdrawSuccess, "Withdrawal failed");
        require(vaultLiquidity[_tokenAddress] >= _amount, "Insufficient vault liquidity");
        
        vaultLiquidity[_tokenAddress] -= _amount;
        
        if (_tokenAddress == NATIVE_ADDRESS) {
            (bool success, ) = msg.sender.call{value: _amount}("");
            require(success, "Native token transfer failed");
        } else {
            IERC20(_tokenAddress).safeTransfer(msg.sender, _amount);
        }
        
        emit TokenWithdrawn(_tokenAddress, msg.sender, _amount);
    }

    /**
     * @notice Allows the contract to receive native tokens
     */
    receive() external payable {}
} 