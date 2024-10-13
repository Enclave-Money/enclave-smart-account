// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IEnclaveTokenVault.sol";

contract EnclaveTokenVaultV0 is ReentrancyGuard, IEnclaveTokenVaultV0 {
    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => bool) public isVaultManager;
    
    constructor() {
        isVaultManager[msg.sender] = true; // Set the deployer as an initial vault manager
        emit VaultManagerAdded(msg.sender);
    }

    modifier onlyVaultManager() {
        require(isVaultManager[msg.sender], "Caller is not a vault manager");
        _;
    }

    function addVaultManager(address _newVaultManager) external onlyVaultManager {
        require(_newVaultManager != address(0), "Invalid vault manager address");
        require(!isVaultManager[_newVaultManager], "Address is already a vault manager");
        isVaultManager[_newVaultManager] = true;
        emit VaultManagerAdded(_newVaultManager);
    }

    function removeVaultManager(address _vaultManager) external onlyVaultManager {
        require(isVaultManager[_vaultManager], "Address is not a vault manager");
        require(msg.sender != _vaultManager, "Cannot remove self as vault manager");
        isVaultManager[_vaultManager] = false;
        emit VaultManagerRemoved(_vaultManager);
    }

    function deposit(address _tokenAddress, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        deposits[_tokenAddress][msg.sender] += _amount;
        emit Deposited(msg.sender, _tokenAddress, _amount);
    }

    function withdraw(address _tokenAddress, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(deposits[_tokenAddress][msg.sender] >= _amount, "Insufficient balance");
        
        deposits[_tokenAddress][msg.sender] -= _amount;
        require(IERC20(_tokenAddress).transfer(msg.sender, _amount), "Transfer failed");
        emit Withdrawn(msg.sender, _tokenAddress, _amount);
    }

    function claim(address _tokenAddress, uint256 _amount, bytes calldata _proof) external nonReentrant onlyVaultManager {
        require(_amount > 0, "Amount must be greater than 0");

        address _owner = abi.decode(_proof[0:20], (address));

        require(deposits[_tokenAddress][_owner] >= _amount, "Insufficient balance");
        deposits[_tokenAddress][_owner] -= _amount;
        require(IERC20(_tokenAddress).transfer(msg.sender, _amount), "Transfer failed");
        emit Claimed(msg.sender, _tokenAddress, _amount, _owner);
    }
}
