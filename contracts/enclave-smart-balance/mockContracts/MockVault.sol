// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MockVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Constant for NATIVE TOKEN address representation
    address constant public NATIVE_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => uint256) public totalDeposits;

    event Deposited(address indexed user, address indexed tokenAddress, uint256 amount);

    constructor() {
        // Initialize ReentrancyGuard
    }

    /**
     * @notice Allows users to deposit ERC20 tokens or NATIVE TOKEN into the vault
     * @param _tokenAddress The token contract address (NATIVE_ADDRESS for NATIVE TOKEN)
     * @param _amount Amount of tokens to deposit
     * @dev For NATIVE TOKEN, amount should match msg.value
     * @dev Updates deposits mapping
     * @dev Emits Deposited event
     */
    function deposit(address _tokenAddress, uint256 _amount) public payable nonReentrant {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");

        if (_tokenAddress == NATIVE_ADDRESS) {
            require(msg.value == _amount, "NATIVE TOKEN amount mismatch");
        } else {
            SafeERC20.safeTransferFrom(IERC20(_tokenAddress), msg.sender, address(this), _amount);
        }

        deposits[_tokenAddress][msg.sender] += _amount;
        totalDeposits[_tokenAddress] += _amount;
        emit Deposited(msg.sender, _tokenAddress, _amount);
    }

    /**
     * @notice Deposits all available balance of a specific token or NATIVE TOKEN
     * @param _tokenAddress The token contract address (NATIVE TOKEN_ADDRESS for NATIVE TOKEN)
     * @dev For NATIVE TOKEN, transfers entire msg.value
     * @dev For tokens, transfers entire token balance from sender
     * @dev Updates deposits mapping
     * @dev Emits Deposited event
     */
    function depositAll(address _tokenAddress) external payable nonReentrant {
        require(_tokenAddress != address(0), "Invalid token address");
        
        if (_tokenAddress == NATIVE_ADDRESS) {
            require(msg.value > 0, "No NATIVE TOKEN sent");
            deposits[_tokenAddress][msg.sender] += msg.value;
            totalDeposits[_tokenAddress] += msg.value;
            emit Deposited(msg.sender, _tokenAddress, msg.value);
        } else {
            IERC20 token = IERC20(_tokenAddress);
            uint256 balance = token.balanceOf(msg.sender);
            require(balance > 0, "No tokens to deposit");
            
            SafeERC20.safeTransferFrom(token, msg.sender, address(this), balance);
            deposits[_tokenAddress][msg.sender] += balance;
            totalDeposits[_tokenAddress] += balance;
            emit Deposited(msg.sender, _tokenAddress, balance);
        }
    }
}
