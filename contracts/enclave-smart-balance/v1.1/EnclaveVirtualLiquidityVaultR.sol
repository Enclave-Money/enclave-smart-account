// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@account-abstraction/contracts/core/BasePaymaster.sol";

import "../../router-contracts/IDapp.sol";
import "../../router-contracts/IGateway.sol";

import "./EnclaveVaultManager.sol";
import "../../enclave-smart-account/EnclaveRegistry.sol";

import "hardhat/console.sol";

contract EnclaveVirtualLiquidityVault is ReentrancyGuard, BasePaymaster, EnclaveVaultManager, IDapp  {

    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => bool) public isRegisteredSolverAddress;
    mapping(address => uint256) public senderNonce;

    mapping(address => uint256) public withdrawNonce;
    mapping(bytes32 => bool) public usedClaimHashes;

    event Deposited(address indexed user, address indexed tokenAddress, uint256 amount);
    event Withdrawn(address indexed user, address indexed tokenAddress, uint256 amount, address indexed vaultManager);
    event SolverSponsored(address indexed user, address indexed tokenAddress, uint256 creditAmount, uint256 futureDebitAmount, address indexed paymaster, bytes reclaimPlan);
    event Claimed(address indexed solver, address indexed tokenAddress, uint256 amount, address indexed owner);

    address public gatewayContract;
    string public routerRNSAddress;   
    string public routerChainId; 

    uint256 private constant VALID_TIMESTAMP_OFFSET = 20; // remains the same
    uint256 private constant TOKEN_ADDRESS_OFFSET = 84;   // updated
    uint256 private constant CREDIT_AMOUNT_OFFSET = 116; 
    uint256 private constant DEBIT_AMOUNT_OFFSET = 148;           // updated
    uint256 private constant SIGNATURE_OFFSET = 180;   
    uint256 private constant RECLAIM_PLAN_OFFSET = 245; // 65 Byte signature for ECDSA eth.sign

    /**
     * @notice Initializes the EnclaveVitualLiquidityPaymaster contract
     * @param _manager Address that will be the initial vault manager and owner
     * @param _entryPoint The EntryPoint contract address for Account Abstraction
     * @param _gatewayContract The gateway contract address for cross-chain communication
     * @param _routerRNSAddress The Router Network Service address
     * @param _routerChainId The chain ID for the router network
     * @dev Sets up initial vault manager, ownership, and core contract parameters
     */
    constructor(
        address _manager, 
        IEntryPoint _entryPoint, 
        address _gatewayContract,
        string memory _routerRNSAddress, 
        string memory _routerChainId
    ) BasePaymaster(_entryPoint) EnclaveVaultManager (_manager)
    {
        routerRNSAddress = _routerRNSAddress;
        routerChainId = _routerChainId;
        gatewayContract = _gatewayContract;
        _transferOwnership(_manager);
        isRegisteredSolverAddress[_manager] = true;
    }

    modifier onlyGateway () {
        require(msg.sender == gatewayContract, "Caller is not gateway");
        _;
    }

    /**
     * return the hash we're going to sign off-chain (and validate on-chain)
     * this method is called by the off-chain service, to sign the request.
     * it is called on-chain from the validatePaymasterUserOp, to validate the signature.
     * note that this signature covers all fields of the UserOperation, except the "paymasterAndData",
     * which will carry the signature itself.
     */
    function getHash(UserOperation calldata userOp, uint48 validUntil, uint48 validAfter, address _tokenAddress, uint256 _amount)
        public
        view
        returns (bytes32)
    {
        //can't use userOp.hash(), since it contains also the paymasterAndData itself.
        return keccak256(
            abi.encode(
                userOp.sender, block.chainid, address(this), senderNonce[userOp.getSender()], validUntil, validAfter, _tokenAddress, _amount
            )
        );
    }

    /**
     * @notice Generates a hash for withdrawal verification
     * @param _tokenAddress Token to withdraw
     * @param _mode Withdrawal mode (0 for partial, 1 for full)
     * @param _amount Amount to withdraw (ignored if mode is 1)
     * @param _sender Address initiating withdrawal
     * @return hash The generated withdrawal hash
     */
    function getWithdrawalHash(address _tokenAddress, uint256 _mode, uint256 _amount, address _sender) public view returns (bytes32 hash) {
        uint256 amount = _amount;
        if (_mode == 1) {
            amount = 0;
        }
        hash = keccak256(abi.encode(_tokenAddress, _mode, amount, _sender, withdrawNonce[_sender], block.chainid));
    }

    /**
     * verify our external signer signed this request.
     * the "paymasterAndData" is expected to be the paymaster and a signature over the entire request params
     * paymasterAndData[:20] : address(this)
     * paymasterAndData[20:84] : abi.encode(validUntil, validAfter)
     * paymasterAndData[84:116] : signature
     * paymasterAndData[116:148] : tokenAddress
     * paymasterAndData[148:212] : amount
     */
    function _validatePaymasterUserOp(UserOperation calldata userOp, bytes32, /*userOpHash*/ uint256 requiredPreFund)
        internal
        override
        returns (bytes memory context, uint256 validationData)
    {
        (requiredPreFund);

        (uint48 validUntil, uint48 validAfter, address _tokenAddress, uint256 _amount, /* uint256 debitAmount*/, bytes calldata signature, /* bytes calldata reclaimPlan */) =
            parsePaymasterAndData(userOp.paymasterAndData);
        //ECDSA library supports both 64 and 65-byte long signatures.
        // we only "require" it here so that the revert reason on invalid signature will be of "VerifyingPaymaster", and not "ECDSA"
        require(
            signature.length == 64 || signature.length == 65,
            "VerifyingPaymaster: invalid signature length in paymasterAndData"
        );
        bytes32 hash = ECDSA.toEthSignedMessageHash(getHash(userOp, validUntil, validAfter, _tokenAddress, _amount));
        senderNonce[userOp.getSender()]++;

        address sponsor = ECDSA.recover(hash, signature);

        if (deposits[_tokenAddress][sponsor] < _amount) {
            // Fail
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        //no need for other on-chain validation: entire UserOp should have been checked
        // by the external service prior to signing it.
        return ("", _packValidationData(false, validUntil, validAfter));
    }

    function parsePaymasterAndData(bytes calldata paymasterAndData)
        public
        pure
        returns (uint48 validUntil, uint48 validAfter, address tokenAddress, uint256 creditAmount, uint256 debitAmount, bytes calldata signature, bytes calldata reclaimPlan)
    {
        (validUntil, validAfter) = abi.decode(paymasterAndData[VALID_TIMESTAMP_OFFSET:TOKEN_ADDRESS_OFFSET], (uint48, uint48));
        (tokenAddress) = abi.decode(paymasterAndData[TOKEN_ADDRESS_OFFSET:CREDIT_AMOUNT_OFFSET], (address));
        (creditAmount) = abi.decode(paymasterAndData[CREDIT_AMOUNT_OFFSET:DEBIT_AMOUNT_OFFSET], (uint256));
        (debitAmount) = abi.decode(paymasterAndData[DEBIT_AMOUNT_OFFSET:SIGNATURE_OFFSET], (uint256));
        signature = paymasterAndData[SIGNATURE_OFFSET:RECLAIM_PLAN_OFFSET];
        reclaimPlan = paymasterAndData[RECLAIM_PLAN_OFFSET:];
    }

    /**
     * @notice Registers a solver address for the system
     * @param _solver Address to be registered as a solver
     * @dev Only callable by vault managers
     * @dev Cannot register zero address
     */
    function registerSolverAddress(address _solver) external onlyVaultManager {
        require(_solver != address(0), "Invalid address: zero address");
        isRegisteredSolverAddress[_solver] = true;
    }

    /**
     * CAB User functions
     * The following functions are called by users looking to take advantage of chain abstracted transaction opportunities 
     */

    /**
     * @notice Allows users to deposit ERC20 tokens into the vault
     * @param _tokenAddress The ERC20 token contract address
     * @param _amount Amount of tokens to deposit
     * @dev Requires approval for token transfer
     * @dev Updates deposits mapping
     * @dev Emits Deposited event
     */
    function deposit(address _tokenAddress, uint256 _amount) external nonReentrant {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        deposits[_tokenAddress][msg.sender] += _amount;
        emit Deposited(msg.sender, _tokenAddress, _amount);
    }

    /**
     * @notice Withdraws tokens with a vault manager signature
     * @param _tokenAddress Token to withdraw
     * @param _amount Amount to withdraw
     * @param signature Vault manager's signature authorizing withdrawal
     * @dev Verifies signature from valid vault manager
     * @dev Updates deposits mapping
     * @dev Emits Withdrawn event
     */
    function withdrawSigned(address _tokenAddress, uint256 _amount, bytes calldata signature) external nonReentrant {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        require(deposits[_tokenAddress][msg.sender] >= _amount, "Insufficient balance");

        bytes32 hash = ECDSA.toEthSignedMessageHash(getWithdrawalHash(_tokenAddress, 0, _amount, msg.sender));        
        address signer = ECDSA.recover(hash, signature);

        require(isVaultManager[signer], "Invalid Signature");
        
        deposits[_tokenAddress][msg.sender] -= _amount;
        IERC20(_tokenAddress).safeTransfer(msg.sender, _amount);

        withdrawNonce[msg.sender]++;

        emit Withdrawn(msg.sender, _tokenAddress, _amount, signer);
    }

    function withdraw(address _tokenAddress, uint256 _amount) external nonReentrant {
        // Depracated
    }

    /**
     * @notice Deposits all available balance of a specific token
     * @param _tokenAddress The ERC20 token contract address
     * @dev Transfers entire token balance from sender
     * @dev Updates deposits mapping
     * @dev Emits Deposited event
     */
    function depositAll(address _tokenAddress) external nonReentrant {
        require(_tokenAddress != address(0), "Invalid token address");
        IERC20 token = IERC20(_tokenAddress);
        uint256 balance = token.balanceOf(msg.sender);

        require(balance > 0, "Amount must be greater than 0");
        require(token.transferFrom(msg.sender, address(this), balance), "Transfer failed");

        deposits[_tokenAddress][msg.sender] += balance;
        emit Deposited(msg.sender, _tokenAddress, balance);
    }

    /**
     * @notice Withdraws all deposited tokens with manager signature
     * @param _tokenAddress Token to withdraw
     * @param signature Vault manager's signature authorizing withdrawal
     * @dev Verifies signature from valid vault manager
     * @dev Sets user's deposit to zero
     * @dev Emits Withdrawn event
     */
    function withdrawAll(address _tokenAddress, bytes calldata signature) external nonReentrant {
        require(_tokenAddress != address(0), "Invalid token address");
        uint256 balance = deposits[_tokenAddress][msg.sender];
        require(balance >= 0, "Insufficient balance");

        bytes32 hash = ECDSA.toEthSignedMessageHash(getWithdrawalHash(_tokenAddress, 1, 0, msg.sender));        
        address signer = ECDSA.recover(hash, signature);

        require(isVaultManager[signer], "Invalid Signature");

        deposits[_tokenAddress][msg.sender] = 0;
        require(IERC20(_tokenAddress).transfer(msg.sender, balance), "Transfer failed");

        withdrawNonce[msg.sender]++;

        emit Withdrawn(msg.sender, _tokenAddress, balance, signer);
    }

    function withdrawToken(address _tokenAddress, uint256 _amount) external onlyOwner() {
        require(_amount > 0, "Solver withdrawal: Invalid amount");
        require(IERC20(_tokenAddress).balanceOf(address(this)) >= _amount, "Solver withdrawal: Insufficient balance");
        require(IERC20(_tokenAddress).transfer(msg.sender, _amount), "Solver withdrawal: Transfer failed");
    }

    function claim(UserOperation calldata userOp, bytes32 _hash, bytes calldata requestMetadata) public {
        bytes32 hash = ECDSA.toEthSignedMessageHash(_hash);
        require(!usedClaimHashes[hash], "Hash already used");
        
        (uint48 validUntil, uint48 validAfter, address _tokenAddress, uint256 _creditAmount, uint256 _debitAmount, bytes calldata signature, bytes calldata reclaimPlan) = parsePaymasterAndData(userOp.paymasterAndData);
        
        require(block.timestamp > validAfter, "Premature claim");
        require(block.timestamp <= validUntil, "Claim signature expired");

        require(isRegisteredSolverAddress[ECDSA.recover(hash, signature)] , "Paymaster: Invalid claim signature");
        
        usedClaimHashes[hash] = true;
        
        require(IERC20(_tokenAddress).transfer(userOp.getSender(), _creditAmount), "Paymaster: Claim failed");  

        _sendRequestPacket(reclaimPlan, requestMetadata);

        emit SolverSponsored(userOp.getSender(), _tokenAddress, _creditAmount, _debitAmount, address(this), reclaimPlan);
    }

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

    function _sendRequestPacket(bytes calldata reclaimPlan, bytes calldata requestMetadata) internal {
        bytes memory requestPacket = abi.encode(routerRNSAddress, reclaimPlan);

        IGateway(
            gatewayContract
        ).iSend(
            1,
            0,
            string(""),
            routerChainId, // router chain id
            requestMetadata,
            requestPacket
        );
    }

    function getRequestMetadata(
        uint64 destGasLimit,
        uint64 destGasPrice,
        uint64 ackGasLimit,
        uint64 ackGasPrice,
        uint128 relayerFees,
        uint8 ackType,
        bool isReadCall,
        bytes memory asmAddress
    ) public pure returns (bytes memory) {
        bytes memory requestMetadata = abi.encodePacked(
            destGasLimit,
            destGasPrice,
            ackGasLimit,
            ackGasPrice,
            relayerFees,
            ackType,
            isReadCall,
            asmAddress
        );
        return requestMetadata;
    }

    function setDappMetadata(string memory feePayerAddress) external onlyVaultManager {
        IGateway(gatewayContract).setDappMetadata(feePayerAddress);
    }
}
