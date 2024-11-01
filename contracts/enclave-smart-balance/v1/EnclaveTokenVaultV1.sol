// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IEnclaveTokenVault.sol";

import "hardhat/console.sol";

contract EnclaveTokenVaultV1 is ReentrancyGuard, IEnclaveTokenVaultV0 {

    // Stores positive
    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => bool) public isVaultManager;
    mapping(address => bool) public isRegisteredSolverAddress;

    constructor(address _vaultManager) {
        isVaultManager[_vaultManager] = true;
        emit VaultManagerAdded(_vaultManager);
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

    function registerSolverAddress(address _solver) external onlyVaultManager {
        require(_solver != address(0), "Invalid address: zero address");
        isRegisteredSolverAddress[_solver] = true;
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
        console.log("Claiming amount: %s", _amount);
        require(_amount > 0, "Amount must be greater than 0");
        console.log("Claim amount: %s", _amount);

        (address _owner, address  _claimer) = abi.decode(_proof, (address, address));

        require(deposits[_tokenAddress][_owner] >= _amount, "Insufficient balance");
        console.log("Sufficient balance");

        deposits[_tokenAddress][_owner] -= _amount;
        console.log("Balance after claim: %s", deposits[_tokenAddress][_owner]);

        require(IERC20(_tokenAddress).transfer(_claimer, _amount), "Transfer failed");
        console.log("Transfer successful");
        emit Claimed(_claimer, _tokenAddress, _amount, _owner);
    }
}
