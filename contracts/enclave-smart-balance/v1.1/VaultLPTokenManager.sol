// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./EnclaveMultichainLPToken.sol";

/**
 * @title VaultLPTokenManager
 * @author Enclave HK Limited
 * @notice Mediator contract between EnclaveMultichainLPToken and external services
 */
contract VaultLPTokenManager is Ownable, ReentrancyGuard {
    EnclaveMultichainLPToken public lpTokenContract;
    
    address public relayer;
    address public lpWithdrawService;
    
    // Chain ID => is supported
    mapping(uint256 => bool) public supportedChains;
    
    event RelayerSet(address indexed oldRelayer, address indexed newRelayer);
    event LPWithdrawServiceSet(address indexed oldService, address indexed newService);
    event ChainSupported(uint256 chainId, bool isSupported);
    event DepositRelayed(address indexed user, address indexed underlyingToken, uint256 amount, uint256 chainId);
    event WithdrawalProcessed(address indexed user, address indexed underlyingToken, uint256 amount, uint256 chainId);
    
    modifier onlyRelayer() {
        require(msg.sender == relayer, "Caller is not the relayer");
        _;
    }
    
    modifier onlyLPWithdrawService() {
        require(msg.sender == lpWithdrawService, "Caller is not the LP withdraw service");
        _;
    }
    
    constructor(
        address _lpTokenContract,
        address _relayer,
        address _lpWithdrawService
    ) {
        require(_lpTokenContract != address(0), "Invalid LP token contract address");
        require(_relayer != address(0), "Invalid relayer address");
        require(_lpWithdrawService != address(0), "Invalid LP withdraw service address");
        
        lpTokenContract = EnclaveMultichainLPToken(_lpTokenContract);
        relayer = _relayer;
        lpWithdrawService = _lpWithdrawService;
    }
    
    /**
     * @notice Updates the LP token contract address
     * @param _newLPTokenContract New LP token contract address
     * @dev Only callable by the owner
     */
    function setLPTokenContract(address _newLPTokenContract) external onlyOwner {
        require(_newLPTokenContract != address(0), "Invalid LP token contract address");
        lpTokenContract = EnclaveMultichainLPToken(_newLPTokenContract);
    }
    
    /**
     * @notice Updates the relayer address
     * @param _newRelayer New relayer address
     * @dev Only callable by the owner
     */
    function setRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "Invalid relayer address");
        address oldRelayer = relayer;
        relayer = _newRelayer;
        emit RelayerSet(oldRelayer, _newRelayer);
    }
    
    /**
     * @notice Updates the LP withdraw service address
     * @param _newLPWithdrawService New LP withdraw service address
     * @dev Only callable by the owner
     */
    function setLPWithdrawService(address _newLPWithdrawService) external onlyOwner {
        require(_newLPWithdrawService != address(0), "Invalid LP withdraw service address");
        address oldService = lpWithdrawService;
        lpWithdrawService = _newLPWithdrawService;
        emit LPWithdrawServiceSet(oldService, _newLPWithdrawService);
    }
    
    /**
     * @notice Adds or removes a supported chain
     * @param _chainId Chain ID to update
     * @param _isSupported Whether the chain should be supported
     * @dev Only callable by the owner
     */
    function setSupportedChain(uint256 _chainId, bool _isSupported) external onlyOwner {
        require(_chainId > 0, "Invalid chain ID");
        supportedChains[_chainId] = _isSupported;
        
        // Also update the LP token contract
        if (_isSupported) {
            lpTokenContract.addSupportedChain(_chainId);
        } else {
            lpTokenContract.removeSupportedChain(_chainId);
        }
        
        emit ChainSupported(_chainId, _isSupported);
    }
    
    /**
     * @notice Creates a new LP token for an underlying token
     * @param _underlyingToken Address of the underlying token
     * @param _lpTokenName Name of the LP token
     * @param _lpTokenSymbol Symbol of the LP token
     * @dev Only callable by the owner
     * @return lpTokenAddress Address of the new LP token
     */
    function createLPToken(
        address _underlyingToken,
        string memory _lpTokenName,
        string memory _lpTokenSymbol
    ) external onlyOwner returns (address) {
        return lpTokenContract.createLPToken(_underlyingToken, _lpTokenName, _lpTokenSymbol);
    }
    
    /**
     * @notice Records a deposit from a user on a specific chain
     * @param _user Address of the user who deposited
     * @param _underlyingToken Address of the deposited token
     * @param _amount Amount deposited
     * @param _chainId Chain ID where deposit occurred
     * @dev Only callable by the relayer
     */
    function relayDeposit(
        address _user,
        address _underlyingToken,
        uint256 _amount,
        uint256 _chainId
    ) external onlyRelayer {
        require(_user != address(0), "Invalid user address");
        require(_underlyingToken != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        require(supportedChains[_chainId], "Unsupported chain ID");
        
        // Forward the call to the LP token contract
        lpTokenContract.recordDeposit(_user, _underlyingToken, _amount, _chainId);
        
        emit DepositRelayed(_user, _underlyingToken, _amount, _chainId);
    }
    
    /**
     * @notice Records a withdrawal from a specific chain
     * @param _underlyingToken Address of the underlying token
     * @param _amount Amount withdrawn
     * @param _chainId Chain ID where withdrawal occurred
     * @dev Only callable by the LP withdraw service
     */
    function processWithdrawal(
        address _underlyingToken,
        uint256 _amount,
        uint256 _chainId
    ) external onlyLPWithdrawService {
        require(_underlyingToken != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        require(supportedChains[_chainId], "Unsupported chain ID");
        
        // Forward the call to the LP token contract
        lpTokenContract.recordWithdrawal(_underlyingToken, _amount, _chainId);
        
        emit WithdrawalProcessed(address(0), _underlyingToken, _amount, _chainId);
    }
    
    /**
     * @notice Processes a user's withdrawal
     * @param _user User who requested the withdrawal
     * @param _underlyingToken Address of the withdrawn token
     * @param _amount Amount withdrawn
     * @param _chainId Chain ID where withdrawal occurred
     * @dev Only callable by the LP withdraw service
     */
    function processUserWithdrawal(
        address _user,
        address _underlyingToken,
        uint256 _amount,
        uint256 _chainId
    ) external onlyLPWithdrawService {
        require(_user != address(0), "Invalid user address");
        require(_underlyingToken != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        require(supportedChains[_chainId], "Unsupported chain ID");
        
        // Forward the call to the LP token contract
        lpTokenContract.recordWithdrawal(_underlyingToken, _amount, _chainId);
        
        emit WithdrawalProcessed(_user, _underlyingToken, _amount, _chainId);
    }
    
    /**
     * @notice View function to calculate the amount of LP tokens for a given underlying amount
     * @param _underlyingToken Address of the underlying token
     * @param _amount Amount of underlying tokens
     * @return Amount of LP tokens
     */
    function calculateLPTokenAmount(address _underlyingToken, uint256 _amount) external view returns (uint256) {
        return lpTokenContract.calculateLPTokenAmount(_underlyingToken, _amount);
    }
    
    /**
     * @notice View function to calculate the amount of underlying tokens for a given LP amount
     * @param _underlyingToken Address of the underlying token
     * @param _lpAmount Amount of LP tokens
     * @return Amount of underlying tokens
     */
    function calculateUnderlyingAmount(address _underlyingToken, uint256 _lpAmount) external view returns (uint256) {
        return lpTokenContract.calculateUnderlyingAmount(_underlyingToken, _lpAmount);
    }
} 