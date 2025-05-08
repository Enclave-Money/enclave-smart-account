// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EnclaveVaultManager.sol";
import "./EnclaveVirtualLiquidityVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VaultLPManager
 * @author Enclave HK Limited
 * @notice Contract for managing LP withdrawals from the vault
 */
contract VaultLPManager is EnclaveVaultManager {
    using SafeERC20 for IERC20;

    address public lpWithdrawService;
    EnclaveVirtualLiquidityVault public liquidityVault;

    event LPWithdrawal(address indexed lpAddress, address indexed tokenAddress, uint256 amount);
    event LPDepositInitiated(address indexed lpAddress, address indexed tokenAddress, uint256 chainId, uint256 amount);

    modifier onlyLPWithdrawService() {
        require(msg.sender == lpWithdrawService, "Caller is not the LP withdraw service");
        _;
    }

    /**
     * @notice Constructor that initializes the contract with required addresses
     * @param _vaultManager Initial vault manager address
     * @param _liquidityVault Address of the EnclaveVirtualLiquidityVault contract
     * @param _lpWithdrawService Address authorized to process LP withdrawals
     */
    constructor(
        address _vaultManager,
        address payable _liquidityVault,
        address _lpWithdrawService
    ) EnclaveVaultManager(_vaultManager) {
        require(_liquidityVault != address(0), "Invalid liquidity vault address");
        require(_lpWithdrawService != address(0), "Invalid LP withdraw service address");
        
        liquidityVault = EnclaveVirtualLiquidityVault(_liquidityVault);
        lpWithdrawService = _lpWithdrawService;
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
     * @notice Sets a new liquidity vault address
     * @param _newLiquidityVault New vault address
     * @dev Only callable by vault manager
     */
    function setLiquidityVault(address payable _newLiquidityVault) external onlyVaultManager {
        require(_newLiquidityVault != address(0), "Invalid liquidity vault address");
        liquidityVault = EnclaveVirtualLiquidityVault(_newLiquidityVault);
    }

    /**
     * @notice Deposits tokens from LP into the virtual liquidity vault
     * @param _lpAddress Address of the LP providing tokens
     * @param _tokenAddress The token address to deposit (use NATIVE_ADDRESS for native tokens)
     * @param _amount Amount to deposit
     * @param _chainId Chain ID where the deposit is credited
     * @dev Callable by vault manager
     * @dev Forwards the tokens to the liquidity vault
     */
    function depositForLP(
        address _lpAddress,
        address _tokenAddress,
        uint256 _amount,
        uint256 _chainId
    ) external payable {
        require(_lpAddress != address(0), "Invalid LP address");
        require(_amount > 0, "Amount must be greater than 0");
        
        if (_tokenAddress == liquidityVault.NATIVE_ADDRESS()) {
            require(msg.value == _amount, "Native token amount mismatch");
            // Forward native token to vault
            address(liquidityVault).call{value: _amount}("");
        } else {
            // Transfer ERC20 tokens from sender to this contract
            IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
            // Approve and transfer to the liquidity vault
            IERC20(_tokenAddress).safeApprove(address(liquidityVault), _amount);
            IERC20(_tokenAddress).safeTransfer(address(liquidityVault), _amount);
        }
        
        emit LPDepositInitiated(_lpAddress, _tokenAddress, _chainId, _amount);
    }

    /**
     * @notice Processes LP withdrawal requests
     * @param _lpAddress Address of the LP to receive tokens
     * @param _tokenAddress The token address to withdraw
     * @param _amount Amount to withdraw
     * @dev Only callable by LP withdraw service
     * @dev Withdraws tokens directly from the liquidity vault and sends to LP address
     */
    function withdrawForLP(
        address _lpAddress,
        address _tokenAddress,
        uint256 _amount
    ) external onlyLPWithdrawService {
        require(_lpAddress != address(0), "Invalid LP address");
        
        // Call withdrawToken function directly on the liquidity vault
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

    /**
     * @notice Batch withdraw for multiple LPs
     * @param _lpAddresses Addresses of the LPs to receive tokens
     * @param _tokenAddresses The token addresses to withdraw
     * @param _amounts Amounts to withdraw
     * @dev Only callable by LP withdraw service
     * @dev All arrays must be the same length
     */
    function batchWithdrawForLPs(
        address[] calldata _lpAddresses,
        address[] calldata _tokenAddresses,
        uint256[] calldata _amounts
    ) external onlyLPWithdrawService {
        require(
            _lpAddresses.length == _tokenAddresses.length && 
            _tokenAddresses.length == _amounts.length,
            "Array lengths must match"
        );
        
        for (uint256 i = 0; i < _lpAddresses.length; i++) {
            address lpAddress = _lpAddresses[i];
            address tokenAddress = _tokenAddresses[i];
            uint256 amount = _amounts[i];
            
            require(lpAddress != address(0), "Invalid LP address");
            
            // Call withdrawToken function directly on the liquidity vault
            liquidityVault.withdrawToken(tokenAddress, amount);
            
            // Transfer tokens to the LP
            if (tokenAddress == liquidityVault.NATIVE_ADDRESS()) {
                (bool success, ) = lpAddress.call{value: amount}("");
                require(success, "Native token transfer failed");
            } else {
                IERC20(tokenAddress).safeTransfer(lpAddress, amount);
            }
            
            emit LPWithdrawal(lpAddress, tokenAddress, amount);
        }
    }

    /**
     * @notice Retrieves the current vault liquidity for a given token
     * @param _tokenAddress The token address to check
     * @return The available liquidity amount
     */
    function getVaultLiquidity(address _tokenAddress) external view returns (uint256) {
        return liquidityVault.getVaultLiquidity(_tokenAddress);
    }

    // Function to receive ETH
    receive() external payable {}
} 