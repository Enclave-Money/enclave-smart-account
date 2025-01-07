// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@account-abstraction/contracts/core/BasePaymaster.sol";

import "../../socket-contracts/IPlug.sol";
import "../../socket-contracts/ISocket.sol";

import "./EnclaveVaultManager.sol";
import "../../enclave-smart-account/EnclaveRegistry.sol";

import "hardhat/console.sol";

/**
 * @title EnclaveVirtualLiquidityVault v1.1
 * @author Enclave HK Limited
 * @notice NOTE
 * This version combines vault and paymaster functionality, supports batched settlement withdrawal, 
 * single solver setup (Enclave), Socket for cross chain comms
 * Subsequent versions will include: Liquidity provisioning, multiple solvers, inbuilt rebalancing 
 */

contract EnclaveVirtualLiquidityVault is ReentrancyGuard, BasePaymaster, EnclaveVaultManager, IPlug  {

    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => uint256) public totalDeposits;

    mapping(address => uint256) public senderNonce;

    mapping(uint32 => address) public siblingPlugs;

    mapping(address => uint256) public withdrawNonce;
    mapping(bytes32 => bool) public usedClaimHashes;

    uint256 public settlementMessageGasLimit;

    event Deposited(address indexed user, address indexed tokenAddress, uint256 amount);
    event Withdrawn(address indexed user, address indexed tokenAddress, uint256 amount, address indexed vaultManager);
    event SolverSponsored(address indexed user, address indexed tokenAddress, uint256 creditAmount, uint256 futureDebitAmount, address indexed paymaster, bytes reclaimPlan);
    event Claimed(address indexed solver, address indexed tokenAddress, uint256 amount, address indexed owner);

    address public socket;
    address public inboundSwitchBoard;   
    address public outboundSwitchBoard; 

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
     * @param _socket The gateway contract address for cross-chain communication
     * @param _inboundSb The Router Network Service address
     * @param _outboundSb The chain ID for the router network
     * @dev Sets up initial vault manager, ownership, and core contract parameters
     */
    constructor(
        address _manager, 
        IEntryPoint _entryPoint, 
        address _socket,
        address _inboundSb, 
        address _outboundSb
    ) BasePaymaster(_entryPoint) EnclaveVaultManager (_manager)
    {
        socket = _socket;
        inboundSwitchBoard = _inboundSb;
        outboundSwitchBoard = _outboundSb;
        _transferOwnership(_manager);
        settlementMessageGasLimit = 100000;
    }

    modifier onlySocket () {
        require(msg.sender == socket, "Caller is not Socket");
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
        console.log("validUntil: %s, validAfter: %s", validUntil, validAfter);

        (tokenAddress) = abi.decode(paymasterAndData[TOKEN_ADDRESS_OFFSET:CREDIT_AMOUNT_OFFSET], (address));
        console.log("tokenAddress: %s", tokenAddress);

        (creditAmount) = abi.decode(paymasterAndData[CREDIT_AMOUNT_OFFSET:DEBIT_AMOUNT_OFFSET], (uint256));
        console.log("creditAmount: %s", creditAmount);

        (debitAmount) = abi.decode(paymasterAndData[DEBIT_AMOUNT_OFFSET:SIGNATURE_OFFSET], (uint256));
        console.log("debitAmount: %s", debitAmount);

        signature = paymasterAndData[SIGNATURE_OFFSET:RECLAIM_PLAN_OFFSET];
        console.log("signature length: %s", signature.length);

        reclaimPlan = paymasterAndData[RECLAIM_PLAN_OFFSET:];
        console.log("reclaimPlan length: %s", reclaimPlan.length);
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
    function deposit(address _tokenAddress, uint256 _amount) public nonReentrant {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        SafeERC20.safeTransferFrom(IERC20(_tokenAddress), msg.sender, address(this), _amount);
        deposits[_tokenAddress][msg.sender] += _amount;
        totalDeposits[_tokenAddress] += _amount;

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
    function withdraw(address _tokenAddress, uint256 _amount, bytes calldata signature) external nonReentrant {
        console.log("Withdraw called - token: %s, amount: %s", _tokenAddress, _amount);
        require(_tokenAddress != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        require(IERC20(_tokenAddress).balanceOf(address(this)) >= _amount, "Insufficient liquidity in vault");
        require(deposits[_tokenAddress][msg.sender] >= _amount, "Insufficient user balance");
        console.log("Initial checks passed");

        bytes32 hash = ECDSA.toEthSignedMessageHash(getWithdrawalHash(_tokenAddress, 0, _amount, msg.sender));        
        address signer = ECDSA.recover(hash, signature);
        console.log("Recovered signer: %s", signer);

        require(isVaultManager[signer], "Invalid Signature");
        console.log("Signature verified");
        
        deposits[_tokenAddress][msg.sender] -= _amount;
        totalDeposits[_tokenAddress] -= _amount;

        console.log("Updated deposits");
        
        SafeERC20.safeTransfer(IERC20(_tokenAddress), msg.sender, _amount);
        console.log("Transfer completed");

        withdrawNonce[msg.sender]++;

        emit Withdrawn(msg.sender, _tokenAddress, _amount, signer);
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

        deposit(_tokenAddress, balance);
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
        console.log("WithdrawAll called - token: %s", _tokenAddress);
        require(_tokenAddress != address(0), "Invalid token address");
        uint256 balance = deposits[_tokenAddress][msg.sender];
        console.log("User balance: %s", balance);
        require(balance >= 0, "Insufficient balance");

        bytes32 hash = ECDSA.toEthSignedMessageHash(getWithdrawalHash(_tokenAddress, 1, 0, msg.sender));        
        address signer = ECDSA.recover(hash, signature);
        console.log("Recovered signer: %s", signer);

        require(isVaultManager[signer], "Invalid Signature");
        console.log("Signature verified");

        deposits[_tokenAddress][msg.sender] = 0;
        totalDeposits[_tokenAddress] -= balance;
        console.log("Updated deposits");
        
        require(IERC20(_tokenAddress).transfer(msg.sender, balance), "Transfer failed");
        console.log("Transfer completed");

        withdrawNonce[msg.sender]++;

        emit Withdrawn(msg.sender, _tokenAddress, balance, signer);
    }

    function getVaultLiquidity(address _tokenAddress) public view returns (uint256) {
        uint256 vaultBalance = IERC20(_tokenAddress).balanceOf(address(this));
        return vaultBalance - totalDeposits[_tokenAddress];
    }

    function withdrawToken(address _tokenAddress, uint256 _amount) external onlyVaultManager {
        require(_amount > 0, "Solver withdrawal: Invalid amount");
        uint256 vaultTokenLiquidity = getVaultLiquidity(_tokenAddress);
        require(vaultTokenLiquidity >= _amount, "Insufficient vault liquidity");
        SafeERC20.safeTransfer(IERC20(_tokenAddress), msg.sender, _amount);
    }

    function claim(UserOperation calldata userOp, bytes32 _hash) public nonReentrant() {
        console.log("Claim called");
        require(!usedClaimHashes[_hash], "Hash already used");
        console.log("Hash check passed");

        bytes32 hash = ECDSA.toEthSignedMessageHash(_hash);
        
        (uint48 validUntil, uint48 validAfter, address _tokenAddress, uint256 _creditAmount, uint256 _debitAmount, bytes calldata signature, bytes calldata reclaimPlan) = parsePaymasterAndData(userOp.paymasterAndData);
        console.log("Parsed paymaster data - valid token: %s, credit: %s, debit: %s", _tokenAddress, _creditAmount, _debitAmount);
        console.log("Block time: ", block.timestamp);
        require(block.timestamp > validAfter, "Premature claim");
        require(block.timestamp <= validUntil, "Claim signature expired");
        console.log("Timestamp checks passed");

        address signingAuthority = ECDSA.recover(hash, signature);
        console.log("Recovered signing authority: %s", signingAuthority);
        require(isVaultManager[signingAuthority] , "Paymaster: Invalid claim signature");
        console.log("Solver verification passed");
        
        usedClaimHashes[_hash] = true;
        
        SafeERC20.safeTransfer(IERC20(_tokenAddress), userOp.getSender(), _creditAmount);
        console.log("Transfer completed");

        _triggerSettlement(reclaimPlan);
        console.log("Settlement triggered");

        emit SolverSponsored(userOp.getSender(), _tokenAddress, _creditAmount, _debitAmount, address(this), reclaimPlan);
    }

    function inbound(
        uint32 srcChainSlug_,
        bytes calldata _payload
    ) external payable onlySocket {
        console.log("Inbound function called");
        (
            address userAddress,
            address tokenAddress,
            uint256 amount,
            address receiverAddress
        ) = abi.decode(
            _payload,
            (address, address, uint256, address)
        );

        console.log("SrcChainSlug: ", srcChainSlug_);
        console.log("User addr: ", userAddress);
        console.log("Token addr: ", tokenAddress);
        console.log("Amount: ", amount);
        console.log("Receiver addr: ", receiverAddress);

        require(amount > 0, "Amount must be greater than 0");
        console.log("Amount check passed");

        require(deposits[tokenAddress][userAddress] >= amount, "Insufficient balance");
        console.log("Sufficient balance check passed");

        deposits[tokenAddress][userAddress] -= amount;
        console.log("Updated deposits - new balance: %s", deposits[tokenAddress][userAddress]);

        deposits[tokenAddress][address(this)] += amount;
        console.log("Transfer successful");

        emit Claimed(receiverAddress, tokenAddress, amount, userAddress);
        console.log("Claim event emitted");
    }

    function _triggerSettlement(bytes calldata reclaimPlan) internal {
        (
            uint32[] memory chainIds, 
            address[] memory tokenAddresses,
            uint256[] memory amounts,
            address receiverAddress,
            address userAddress
        ) = abi.decode(reclaimPlan, (uint32[], address[], uint256[], address, address));

        // Verify arrays have same length
        require(chainIds.length == tokenAddresses.length && chainIds.length == amounts.length, 
            "Array lengths must match");

        uint256 MAX_BATCH_SIZE = 10; // Configurable
        for (uint i = 0; i < chainIds.length;) {
            require(i < MAX_BATCH_SIZE, "Batch too large");
            _sendSettlementMessage(
                chainIds[i],
                settlementMessageGasLimit, // gasLimit - you may want to make this configurable
                userAddress,
                tokenAddresses[i],
                amounts[i],
                receiverAddress
            );
            unchecked { ++i; }
        }
    }

    function _sendSettlementMessage(
        uint32 destinationChainSlug,
        uint256 gasLimit_,
        address userAddress, 
        address tokenAddress, 
        uint256 amount, 
        address receiverAddress
    ) internal {
        bytes memory payload = abi.encode(userAddress, tokenAddress, amount, receiverAddress);
        uint256 fees = ISocket(socket).getMinFees(
            gasLimit_, payload.length, bytes32(0), bytes32(0), destinationChainSlug, siblingPlugs[destinationChainSlug]);

        ISocket(
            socket
        ).outbound{value: fees}(
            destinationChainSlug,
            gasLimit_,
            bytes32(0),
            bytes32(0),
            payload
        );
    }

    function connectToPlug(uint32 _remoteChainSlug, address _remotePlug) external onlyVaultManager {
        ISocket(socket).connect(
            _remoteChainSlug, _remotePlug, inboundSwitchBoard, outboundSwitchBoard
        );
        siblingPlugs[_remoteChainSlug] = _remotePlug;
    }
}
