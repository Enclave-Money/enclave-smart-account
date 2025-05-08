// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EnclaveMultichainLPToken
 * @author Enclave HK Limited
 * @notice ERC20 LP tokens for liquidity providers across multiple chains
 */
contract EnclaveMultichainLPToken is Ownable, ReentrancyGuard {
    // Manager contract that can interact with this contract
    address public lpTokenManager;

    // Underlying token address => LP token address
    mapping(address => address) public lpTokens;

    // Chain ID => is supported
    mapping(uint256 => bool) public supportedChains;

    event LPTokenCreated(
        address indexed underlyingToken,
        address indexed lpToken
    );
    event TokensDeposited(
        address indexed underlyingToken,
        uint256 amount,
        uint256 chainId,
        address indexed user
    );
    event WithdrawalRequested(
        address indexed underlyingToken,
        uint256 amount,
        address indexed user,
        uint256 chainId
    );
    event ManagerUpdated(
        address indexed oldManager,
        address indexed newManager
    );

    modifier onlyManager() {
        require(
            msg.sender == lpTokenManager,
            "Caller is not the LP token manager"
        );
        _;
    }

    constructor(address _lpTokenManager) {
        require(
            _lpTokenManager != address(0),
            "Invalid LP token manager address"
        );
        lpTokenManager = _lpTokenManager;
    }

    /**
     * @notice Updates the LP token manager address
     * @param _newManager New manager address
     * @dev Only callable by the owner
     */
    function setLPTokenManager(address _newManager) external onlyOwner {
        require(_newManager != address(0), "Invalid manager address");
        address oldManager = lpTokenManager;
        lpTokenManager = _newManager;
        emit ManagerUpdated(oldManager, _newManager);
    }

    /**
     * @notice Adds a supported chain
     * @param _chainId Chain ID to add
     * @dev Only callable by the manager
     */
    function addSupportedChain(uint256 _chainId) external onlyManager {
        require(_chainId > 0, "Invalid chain ID");
        supportedChains[_chainId] = true;
    }

    /**
     * @notice Removes a supported chain
     * @param _chainId Chain ID to remove
     * @dev Only callable by the manager
     */
    function removeSupportedChain(uint256 _chainId) external onlyManager {
        supportedChains[_chainId] = false;
    }

    /**
     * @notice Creates a new LP token for an underlying token
     * @param _underlyingToken Address of the underlying token
     * @param _lpTokenName Name of the LP token
     * @param _lpTokenSymbol Symbol of the LP token
     * @dev Only callable by the manager
     * @return lpTokenAddress Address of the new LP token
     */
    function createLPToken(
        address _underlyingToken,
        string memory _lpTokenName,
        string memory _lpTokenSymbol
    ) external onlyManager returns (address lpTokenAddress) {
        require(
            _underlyingToken != address(0),
            "Invalid underlying token address"
        );
        require(
            lpTokens[_underlyingToken] == address(0),
            "LP token already exists for this underlying token"
        );

        // Create a new LP token
        EnclaveTokenLP newLPToken = new EnclaveTokenLP(
            _lpTokenName,
            _lpTokenSymbol,
            address(this)
        );
        lpTokenAddress = address(newLPToken);

        lpTokens[_underlyingToken] = lpTokenAddress;
        emit LPTokenCreated(_underlyingToken, lpTokenAddress);
    }

    /**
     * @notice Records a deposit and mints LP tokens to the user
     * @param _user Address of the user who deposited
     * @param _underlyingToken Address of the deposited token
     * @param _amount Amount deposited
     * @param _chainId Chain ID where deposit occurred
     * @dev Only callable by the manager
     * @dev Mints LP tokens to the user based on their share of the total pool
     */
    function recordDeposit(
        address _user,
        address _underlyingToken,
        uint256 _amount,
        uint256 _chainId
    ) external onlyManager {
        require(_user != address(0), "Invalid user address");
        require(_underlyingToken != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        require(supportedChains[_chainId], "Unsupported chain ID");

        address lpTokenAddress = lpTokens[_underlyingToken];
        require(
            lpTokenAddress != address(0),
            "LP token not created for this underlying token"
        );

        // Mint LP tokens to user
        EnclaveTokenLP(lpTokenAddress).mint(_user, _amount);

        emit TokensDeposited(
            _underlyingToken,
            _amount,
            _chainId,
            _user
        );
    }

    /**
     * @notice Allows an LP to request withdrawal of their underlying tokens
     * @param _underlyingToken Address of the underlying token
     * @param _lpAmount Amount of LP tokens to burn
     * @param _chainId Chain ID where withdrawal is requested
     * @dev Burns user's LP tokens and emits an event for the LP withdraw service
     * @dev The actual withdrawal will be processed by the EnclaveMultichainLPTokenManager on the target chain
     */
    function requestWithdrawal(
        address _underlyingToken,
        uint256 _lpAmount,
        uint256 _chainId
    ) external {
        require(_underlyingToken != address(0), "Invalid token address");
        require(_lpAmount > 0, "Amount must be greater than 0");
        require(supportedChains[_chainId], "Unsupported chain ID");

        address lpTokenAddress = lpTokens[_underlyingToken];
        require(
            lpTokenAddress != address(0),
            "LP token not created for this underlying token"
        );

        // Burn LP tokens
        EnclaveTokenLP(lpTokenAddress).burnFrom(msg.sender, _lpAmount);

        // Emit event for the LP withdraw service to process on the target chain
        emit WithdrawalRequested(
            _underlyingToken,
            _lpAmount,
            msg.sender,
            _chainId
        );
    }
}


/**
 * @title EnclaveTokenLP
 * @notice ERC20 LP token for a specific underlying token
 */
contract EnclaveTokenLP is ERC20, ERC20Burnable, Ownable {
    address public lpManager;

    constructor(
        string memory _name,
        string memory _symbol,
        address _lpManager
    ) ERC20(_name, _symbol) {
        require(_lpManager != address(0), "Invalid LP manager address");
        lpManager = _lpManager;
        _transferOwnership(_lpManager);
    }

    /**
     * @notice Mints tokens to a specified address
     * @param _to Address to mint tokens to
     * @param _amount Amount of tokens to mint
     * @dev Only callable by the owner (LP manager)
     */
    function mint(address _to, uint256 _amount) external onlyOwner {
        _mint(_to, _amount);
    }
}
