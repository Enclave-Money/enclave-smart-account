// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */
/* solhint-disable no-inline-assembly */

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../router-contracts/IGateway.sol";

import "hardhat/console.sol";
/**
 * A sample paymaster that uses external service to decide whether to pay for the UserOp.
 * The paymaster trusts an external signer to sign the transaction.
 * The calling user must pass the UserOp to that external signer first, which performs
 * whatever off-chain verification before signing the UserOp.
 * Note that this signature is NOT a replacement for the account-specific signature:
 * - the paymaster checks a signature to agree to PAY for GAS.
 * - the account checks a signature to prove identity and account ownership.
 */

contract EnclaveSolverPaymasterV2D is BasePaymaster {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    address public immutable verifyingSigner;
    address public gatewayContract;
    string public routerRNSAddress;
    string public routerChainId;

    uint256 private constant VALID_TIMESTAMP_OFFSET = 20; // remains the same
    uint256 private constant TOKEN_ADDRESS_OFFSET = 84;   // updated
    uint256 private constant CREDIT_AMOUNT_OFFSET = 116; 
    uint256 private constant DEBIT_AMOUNT_OFFSET = 148;           // updated
    uint256 private constant SIGNATURE_OFFSET = 180;   
    uint256 private constant RECLAIM_PLAN_OFFSET = 245; // 65 Byte signature for ECDSA eth.sign

    constructor(
        address _verifyingSigner, 
        IEntryPoint _entryPoint, 
        address _gatewayContract,
        string memory _routerRNSAddress, 
        string memory _routerChainId
    ) BasePaymaster(_entryPoint)
    {
        verifyingSigner = _verifyingSigner;
        routerRNSAddress = _routerRNSAddress;
        routerChainId = _routerChainId;
        gatewayContract = _gatewayContract;
        _transferOwnership(verifyingSigner);
    }

    mapping(address => uint256) public senderNonce;

    event SolverSponsored(address indexed user, address indexed tokenAddress, uint256 creditAmount, uint256 futureDebitAmount, address indexed paymaster, bytes reclaimPlan);

    function pack(UserOperation calldata userOp) internal pure returns (bytes memory ret) {
        address sender = userOp.sender;
        uint256 nonce = userOp.nonce;
        bytes32 hashInitCode = calldataKeccak(userOp.initCode);
        bytes32 hashCallData = calldataKeccak(userOp.callData);
        uint256 callGasLimit = userOp.callGasLimit;
        uint256 verificationGasLimit = userOp.verificationGasLimit;
        uint256 preVerificationGas = userOp.preVerificationGas;
        uint256 maxFeePerGas = userOp.maxFeePerGas;
        uint256 maxPriorityFeePerGas = userOp.maxPriorityFeePerGas;

        return abi.encode(
            sender,
            nonce,
            hashInitCode,
            hashCallData,
            callGasLimit,
            verificationGasLimit,
            preVerificationGas,
            maxFeePerGas,
            maxPriorityFeePerGas
        );
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

        //don't revert on signature failure: return SIG_VALIDATION_FAILED
        if (verifyingSigner != ECDSA.recover(hash, signature)) {
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

    function withdrawToken(address _tokenAddress, uint256 _amount) external onlyOwner() {
        require(_amount > 0, "Solver withdrawal: Invalid amount");
        require(IERC20(_tokenAddress).balanceOf(msg.sender) >= _amount, "Solver withdrawal: Insufficient balance");
        require(IERC20(_tokenAddress).transfer(msg.sender, _amount), "Solver withdrawal: Transfer failed");
    }

    function claim(UserOperation calldata userOp, bytes32 hash, bytes calldata requestMetadata) public {
        (uint48 validUntil, uint48 validAfter, address _tokenAddress, uint256 _creditAmount, uint256 _debitAmount, bytes calldata signature, bytes calldata reclaimPlan) = parsePaymasterAndData(userOp.paymasterAndData);
        (validAfter);
        (validUntil);
        require(verifyingSigner == ECDSA.recover(hash, signature), "Paymaster: Invalid claim signature");
        require(IERC20(_tokenAddress).transfer(userOp.getSender(), _creditAmount), "Paymaster: Claim failed");

        _sendRequestPacket(reclaimPlan, requestMetadata);

        emit SolverSponsored(userOp.getSender(), _tokenAddress, _creditAmount, _debitAmount, address(this), reclaimPlan);
    }

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

    function setDappMetadata(string memory feePayerAddress) external  {
        IGateway(gatewayContract).setDappMetadata(feePayerAddress);
    }
}