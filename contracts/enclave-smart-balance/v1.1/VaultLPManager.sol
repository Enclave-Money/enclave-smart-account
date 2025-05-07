// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EnclaveVaultManager.sol";
import "./EnclaveVirtualLiquidityVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VaultLPManager
 * @author Enclave HK Limited
 * @notice Contract for managing LP withdrawals and rebalancing across chains
 */
contract VaultLPManager is EnclaveVaultManager {
    using SafeERC20 for IERC20;

    address public rebalancer;
    address public lpWithdrawService;
    EnclaveVirtualLiquidityVault public liquidityVault;

    event Rebalanced(address indexed tokenAddress, uint256 amount, uint256 chainId, bytes bridgeData);
    event LPWithdrawal(address indexed lpAddress, address indexed tokenAddress, uint256 amount);

    modifier onlyRebalancer() {
        require(msg.sender == rebalancer, "Caller is not the rebalancer");
        _;
    }

    modifier onlyLPWithdrawService() {
        require(msg.sender == lpWithdrawService, "Caller is not the LP withdraw service");
        _;
    }

    /**
     * @notice Constructor that initializes the contract with required addresses
     * @param _vaultManager Initial vault manager address
     * @param _liquidityVault Address of the EnclaveVirtualLiquidityVault contract
     * @param _rebalancer Address authorized to perform rebalancing
     * @param _lpWithdrawService Address authorized to process LP withdrawals
     */
    constructor(
        address _vaultManager,
        address payable _liquidityVault,
        address _rebalancer,
        address _lpWithdrawService
    ) EnclaveVaultManager(_vaultManager) {
        require(_liquidityVault != address(0), "Invalid liquidity vault address");
        require(_rebalancer != address(0), "Invalid rebalancer address");
        require(_lpWithdrawService != address(0), "Invalid LP withdraw service address");
        
        liquidityVault = EnclaveVirtualLiquidityVault(_liquidityVault);
        rebalancer = _rebalancer;
        lpWithdrawService = _lpWithdrawService;
    }

    /**
     * @notice Updates the rebalancer address
     * @param _newRebalancer New rebalancer address
     * @dev Only callable by vault manager
     */
    function setRebalancer(address _newRebalancer) external onlyVaultManager {
        require(_newRebalancer != address(0), "Invalid rebalancer address");
        rebalancer = _newRebalancer;
    }

    /**
     * @notice Updates the LP withdraw service address
     * @param _newLPWithdrawService New LP withdraw service address
     * @dev Only callable by vault manager
     */
    function setLPWithdrawService(address _newLPWithdrawService) external onlyVaultManager {
        require(_newLPWithdrawService != address(0), "Invalid LP withdraw service address");
        lpWithdrawService = _newLPWithdrawService;
    }

    /**
     * @notice Rebalances tokens by withdrawing from vault and preparing for cross-chain transfer
     * @param _tokenAddress The token address to rebalance
     * @param _amount Amount to withdraw
     * @param _targetChainId Target chain ID for bridging
     * @param _bridgeData Additional data needed for the bridge operation
     * @dev Only callable by rebalancer
     * @dev Withdraws tokens from vault and emits Rebalanced event
     */
    function rebalanceToChain(
        address _tokenAddress,
        uint256 _amount,
        uint256 _targetChainId,
        bytes calldata _bridgeData
    ) external onlyRebalancer {
        // Call withdrawToken function on the liquidity vault
        liquidityVault.withdrawToken(_tokenAddress, _amount);
        
        // Handle the withdrawn tokens (would typically involve bridge integration)
        // For this implementation, we'll just emit an event
        emit Rebalanced(_tokenAddress, _amount, _targetChainId, _bridgeData);
        
        // Future implementation would include bridge contract calls
        // bridgeContract.bridgeTokens(_tokenAddress, _amount, _targetChainId, _bridgeData);
    }

    /**
     * @notice Processes LP withdrawal requests
     * @param _lpAddress Address of the LP to receive tokens
     * @param _tokenAddress The token address to withdraw
     * @param _amount Amount to withdraw
     * @dev Only callable by LP withdraw service
     * @dev Withdraws tokens from vault and sends to LP address
     */
    function withdrawForLP(
        address _lpAddress,
        address _tokenAddress,
        uint256 _amount
    ) external onlyLPWithdrawService {
        require(_lpAddress != address(0), "Invalid LP address");
        
        // Call withdrawToken function on the liquidity vault
        liquidityVault.withdrawToken(_tokenAddress, _amount);
        
        // Transfer tokens to the LP
        if (_tokenAddress == liquidityVault.NATIVE_ADDRESS()) {
            (bool success, ) = _lpAddress.call{value: _amount}("");
            require(success, "Native token transfer failed");
        } else {
            IERC20(_tokenAddress).safeTransfer(_lpAddress, _amount);
        }
        
        emit LPWithdrawal(_lpAddress, _tokenAddress, _amount);
    }

    // Function to receive ETH
    receive() external payable {}
} 