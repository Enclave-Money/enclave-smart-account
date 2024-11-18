// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IEnclaveTokenVault.sol";
import "../../router-contracts/IDapp.sol";
import "../../router-contracts/IGateway.sol";

import "../../enclave-smart-account/EnclaveRegistry.sol";

import "hardhat/console.sol";

contract EnclaveTokenVaultV1B is ReentrancyGuard, IEnclaveTokenVaultV0, IDapp {

    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => bool) public isVaultManager;
    mapping(address => bool) public isRegisteredSolverAddress;

    address public gatewayContract;
    string public routerRNSAddress;   
    string public routerChainId; 

    constructor(address _vaultManager, address _gatewayContract, string memory _routerRNSAddress, string memory _routerChainId) {
        isVaultManager[_vaultManager] = true;
        gatewayContract = _gatewayContract;
        routerRNSAddress = _routerRNSAddress;
        routerChainId = _routerChainId;
        emit VaultManagerAdded(_vaultManager);
    }

    modifier onlyVaultManager() {
        require(isVaultManager[msg.sender], "Caller is not a vault manager");
        _;
    }

    modifier onlyGateway () {
        require(msg.sender == gatewayContract, "Caller is not gateway");
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
        require(_tokenAddress != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        require(IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        deposits[_tokenAddress][msg.sender] += _amount;
        emit Deposited(msg.sender, _tokenAddress, _amount);
    }

    function withdraw(address _tokenAddress, uint256 _amount) external nonReentrant {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        require(deposits[_tokenAddress][msg.sender] >= _amount, "Insufficient balance");
        
        deposits[_tokenAddress][msg.sender] -= _amount;
        require(IERC20(_tokenAddress).transfer(msg.sender, _amount), "Transfer failed");
        emit Withdrawn(msg.sender, _tokenAddress, _amount);
    }

    function depositAll(address _tokenAddress) external nonReentrant {
        require(_tokenAddress != address(0), "Invalid token address");
        IERC20 token = IERC20(_tokenAddress);
        uint256 balance = token.balanceOf(msg.sender);

        require(balance > 0, "Amount must be greater than 0");
        require(token.transferFrom(msg.sender, address(this), balance), "Transfer failed");

        deposits[_tokenAddress][msg.sender] += balance;
        emit Deposited(msg.sender, _tokenAddress, balance);
    }

    function withdrawAll(address _tokenAddress) external nonReentrant {
        require(_tokenAddress != address(0), "Invalid token address");
        uint256 balance = deposits[_tokenAddress][msg.sender];
        require(balance >= 0, "Insufficient balance");
        deposits[_tokenAddress][msg.sender] = 0;
        require(IERC20(_tokenAddress).transfer(msg.sender, balance), "Transfer failed");
        emit Withdrawn(msg.sender, _tokenAddress, balance);
    }

    function claim(address _tokenAddress, uint256 _amount, bytes calldata _proof) external nonReentrant onlyVaultManager {}

    function iReceive(
        string calldata requestSender, 
        bytes calldata packet,
        string calldata srcChainId
    ) external onlyGateway returns (bytes memory) {
        (
            address userAddress,
            address tokenAddress,
            uint256 amount,
            address receiverAddress
        ) = abi.decode(
            packet,
            (address, address, uint256, address)
        );

        require(
            keccak256(bytes(requestSender)) == keccak256(bytes(routerRNSAddress)),
            "Invalid request sender"
        );
        
        require(
            keccak256(bytes(srcChainId)) == keccak256((bytes(routerChainId))),
            "Invalid source chain id"
        );

        console.log("Claiming amount: %s", amount);
        require(amount > 0, "Amount must be greater than 0");

        require(deposits[tokenAddress][userAddress] >= amount, "Insufficient balance");
        console.log("Sufficient balance");

        deposits[tokenAddress][userAddress] -= amount;
        console.log("Balance after claim: %s", deposits[tokenAddress][userAddress]);

        require(IERC20(tokenAddress).transfer(receiverAddress, amount), "Transfer failed");
        console.log("Transfer successful");
        emit Claimed(receiverAddress, tokenAddress, amount, userAddress);
        
        return abi.encode(requestSender, packet, srcChainId);
    }

    function iAck(uint256 requestIdentifier, bool execFlags, bytes memory execData) external {}

    function setDappMetadata(string memory feePayerAddress) external onlyVaultManager {
        IGateway(gatewayContract).setDappMetadata(feePayerAddress);
    }
}
