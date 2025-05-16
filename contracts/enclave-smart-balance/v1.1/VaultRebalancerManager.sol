// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EnclaveVaultManager.sol";
import "./EnclaveVirtualLiquidityVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VaultRebalancerManager
 * @author Enclave HK Limited
 * @notice Contract for managing cross-chain rebalancing operations
 */
contract VaultRebalancerManager is EnclaveVaultManager {
    using SafeERC20 for IERC20;

    address public rebalancer;
    EnclaveVirtualLiquidityVault public liquidityVault;

    event Rebalanced(
        address indexed tokenAddress,
        uint256 amount,
        uint256 chainId,
        bytes bridgeData
    );
    event TokenTransferred(
        address indexed tokenAddress,
        address indexed recipient,
        uint256 amount
    );

    modifier onlyRebalancer() {
        require(msg.sender == rebalancer, "Caller is not the rebalancer");
        _;
    }

    /**
     * @notice Constructor that initializes the contract with required addresses
     * @param _vaultManager Initial vault manager address
     * @param _liquidityVault Address of the EnclaveVirtualLiquidityVault contract
     * @param _rebalancer Address authorized to perform rebalancing
     */
    constructor(
        address _vaultManager,
        address payable _liquidityVault,
        address _rebalancer
    ) EnclaveVaultManager(_vaultManager) {
        require(
            _liquidityVault != address(0),
            "Invalid liquidity vault address"
        );
        require(_rebalancer != address(0), "Invalid rebalancer address");

        liquidityVault = EnclaveVirtualLiquidityVault(_liquidityVault);
        rebalancer = _rebalancer;
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
     * @notice Sets a new liquidity vault address
     * @param _newLiquidityVault New vault address
     * @dev Only callable by vault manager
     */
    function setLiquidityVault(
        address payable _newLiquidityVault
    ) external onlyVaultManager {
        require(
            _newLiquidityVault != address(0),
            "Invalid liquidity vault address"
        );
        liquidityVault = EnclaveVirtualLiquidityVault(_newLiquidityVault);
    }

    /**
     * @notice Rebalances tokens by withdrawing from vault and preparing for cross-chain transfer
     * @param _tokenAddress The token address to rebalance
     * @param _amount Amount to withdraw
     * @param _targetChainId Target chain ID for bridging 
     * @param isTransferRequired Whether tokens need to be transferred to bridge address
     * @param isApproveRequired Whether tokens need to be approved for bridge address
     * @param bridgeAddress Address of the bridge contract to interact with
     * @param _bridgeData Additional data needed for the bridge operation
     * @dev Only callable by rebalancer
     * @dev Directly calls the liquidityVault for token withdrawal
     * @dev Will approve and/or transfer tokens to bridge if specified
     * @dev Makes arbitrary call to bridge contract with provided data
     */
    function rebalanceToChain(
        address _tokenAddress,
        uint256 _amount,
        uint256 _targetChainId,
        bool isTransferRequired,
        bool isApproveRequired,
        address bridgeAddress,
        bytes calldata _bridgeData
    ) external onlyRebalancer {
        require(bridgeAddress != address(0), "Invalid bridge address");
        require(_amount > 0, "Amount must be greater than 0");

        // Withdraw tokens from liquidity vault
        liquidityVault.withdrawToken(_tokenAddress, _amount);

        // Handle token approvals if required
        if (isApproveRequired) {
            approveTokenAfterWithdrawal(_tokenAddress, bridgeAddress, _amount);
        }

        // Handle token transfers if required
        if (isTransferRequired) {
            transferTokenAfterWithdrawal(_tokenAddress, bridgeAddress, _amount);
        }

        // Make bridge call with appropriate value
        bool success;
        if (_tokenAddress == liquidityVault.NATIVE_ADDRESS()) {
            (success,) = bridgeAddress.call{value: _amount}(_bridgeData);
        } else {
            (success,) = bridgeAddress.call(_bridgeData);
        }
        require(success, "Bridge call failed");

        emit Rebalanced(_tokenAddress, _amount, _targetChainId, _bridgeData);
    }

    /**
     * @notice Transfers tokens to another address after they've been withdrawn
     * @param _tokenAddress The token address to transfer
     * @param _recipient The recipient address
     * @param _amount Amount to transfer
     * @dev Only callable by rebalancer
     */
    function transferTokenAfterWithdrawal(
        address _tokenAddress,
        address _recipient,
        uint256 _amount
    ) internal {

        // Transfer tokens to the recipient
        if (_tokenAddress == liquidityVault.NATIVE_ADDRESS()) {
            // For native token transfers
            (bool success, ) = _recipient.call{value: _amount}("");
            require(success, "Native token transfer failed");
        } else {
            // For ERC20 token transfers
            IERC20(_tokenAddress).safeTransfer(_recipient, _amount);
        }

        emit TokenTransferred(_tokenAddress, _recipient, _amount);
    }

    /**
     * @notice Approves spending of tokens after they've been withdrawn
     * @param _tokenAddress The token address to approve
     * @param _spender The spender address
     * @param _amount Amount to approve
     * @dev Only callable by rebalancer
     */
    function approveTokenAfterWithdrawal(
        address _tokenAddress,
        address _spender,
        uint256 _amount
    ) internal {
        require(
            _tokenAddress != liquidityVault.NATIVE_ADDRESS(),
            "Cannot approve native tokens"
        );

        // Approve tokens for the spender
        IERC20(_tokenAddress).safeApprove(_spender, _amount);
    }

    /**
     * @notice Retrieves the current vault liquidity for a given token
     * @param _tokenAddress The token address to check
     * @return The available liquidity amount
     */
    function getVaultLiquidity(
        address _tokenAddress
    ) external view returns (uint256) {
        return liquidityVault.getVaultLiquidity(_tokenAddress);
    }

    // Function to receive ETH
    receive() external payable {}
}
