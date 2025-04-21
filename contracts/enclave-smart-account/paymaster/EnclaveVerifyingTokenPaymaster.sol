// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */
/* solhint-disable no-inline-assembly */

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IEnclaveFeeLogic.sol";
import "./UniswapHelper.sol";

/**
 * A paymaster that uses external service to decide whether to pay for the UserOp.
 * The paymaster trusts an external signer to sign the transaction.
 * The calling user must pass the UserOp to that external signer first, which performs
 * whatever off-chain verification before signing the UserOp.
 * Note that this signature is NOT a replacement for the account-specific signature:
 * - the paymaster checks a signature to agree to PAY for GAS.
 * - the account checks a signature to prove identity and account ownership.
 */
contract EnclaveVerifyingTokenPaymaster is BasePaymaster, UniswapHelper {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    event FeeLogicUpdated(address indexed oldFeeLogic, address indexed newFeeLogic, uint256 timestamp);
    event PaymentTokenUpdated(address indexed oldPaymentToken, address indexed newPaymentToken, uint256 timestamp);
    event SwapResult(bool success, string reason, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, uint256 amountOut, uint256 timestamp);
    event VerifyingSignerUpdated(address indexed oldSigner, address indexed newSigner, uint256 timestamp);

    address public verifyingSigner;
    ERC20 public paymentToken;
    IEnclaveFeeLogic public feeLogic;
    
    uint256 private constant VALID_TIMESTAMP_OFFSET = 20;
    uint256 private constant SIGNATURE_OFFSET = 84;

    // Sender nonce tracking
    mapping(address => uint256) public senderNonce;

    /**
     * @param _entryPoint The EntryPoint contract used with this paymaster
     * @param _verifyingSigner The trusted signer for paymaster operations
     * @param _paymentToken ERC20 token used for transaction fee payment
     * @param _feeLogicContract Contract that determines fee calculation logic
     * @param _wrappedNative Wrapped native token (WETH) for swaps
     * @param _uniswapRouter Uniswap router address for token swapping
     */
    constructor(
        IEntryPoint _entryPoint, 
        address _verifyingSigner, 
        address _paymentToken, 
        address _feeLogicContract, 
        address _wrappedNative, 
        address _uniswapRouter
    ) BasePaymaster(_entryPoint) UniswapHelper(
        IERC20(_paymentToken),
        IERC20(_wrappedNative),
        ISwapRouter(_uniswapRouter),
        UniswapHelperConfig({
            minSwapAmount: 0,
            uniswapPoolFee: 3000, // 0.3% fee tier
            slippage: 50 // 5.0% slippage
        })
    ) {
        verifyingSigner = _verifyingSigner;
        paymentToken = ERC20(_paymentToken);
        feeLogic = IEnclaveFeeLogic(_feeLogicContract);
    }

    /**
     * Update the verifying signer
     * @param _verifyingSigner Address of the new verifying signer
     */
    function updateVerifyingSigner(address _verifyingSigner) external onlyOwner {        
        verifyingSigner = _verifyingSigner;
        emit VerifyingSignerUpdated(address(verifyingSigner), _verifyingSigner, block.timestamp);
    }

    /**
     * Update the fee logic contract
     * @param _feeLogicContract Address of the new fee logic contract
     */
    function updateFeeLogic(address _feeLogicContract) external onlyOwner {
        feeLogic = IEnclaveFeeLogic(_feeLogicContract);
        emit FeeLogicUpdated(address(feeLogic), _feeLogicContract, block.timestamp);
    }

    /**
     * Update the payment token
     * @param _paymentToken Address of the new payment token
     */
    function updatePaymentToken(address _paymentToken) external onlyOwner {
        paymentToken = ERC20(_paymentToken);
        emit PaymentTokenUpdated(address(paymentToken), _paymentToken, block.timestamp);
    }

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
     * Return the hash we're going to sign off-chain (and validate on-chain)
     * This method is called by the off-chain service to sign the request,
     * and on-chain from validatePaymasterUserOp to validate the signature.
     * @param userOp The user operation to be signed/verified
     * @param validUntil The timestamp until which the signature is valid
     * @param validAfter The timestamp after which the signature is valid
     * @return The hash to be signed
     */
    function getHash(UserOperation calldata userOp, uint48 validUntil, uint48 validAfter)
        public
        view
        returns (bytes32)
    {
        //can't use userOp.hash(), since it contains also the paymasterAndData itself.
        return keccak256(
            abi.encode(
                pack(userOp), block.chainid, address(this), senderNonce[userOp.getSender()], validUntil, validAfter
            )
        );
    }

    /**
     * Verify our external signer signed this request
     * The "paymasterAndData" is expected to be the paymaster and a signature over the request params
     * paymasterAndData[:20] : address(this)
     * paymasterAndData[20:84] : abi.encode(validUntil, validAfter)
     * paymasterAndData[84:] : signature
     */
    function _validatePaymasterUserOp(UserOperation calldata userOp, bytes32, /*userOpHash*/ uint256 requiredPreFund)
        internal
        override
        returns (bytes memory context, uint256 validationData)
    {

        (uint48 validUntil, uint48 validAfter, bytes calldata signature) =
            parsePaymasterAndData(userOp.paymasterAndData);
        //ECDSA library supports both 64 and 65-byte long signatures.
        // we only "require" it here so that the revert reason on invalid signature will be of "VerifyingPaymaster", and not "ECDSA"
        require(
            signature.length == 64 || signature.length == 65,
            "VerifyingPaymaster: invalid signature length in paymasterAndData"
        );
        bytes32 hash = ECDSA.toEthSignedMessageHash(getHash(userOp, validUntil, validAfter));
        senderNonce[userOp.getSender()]++;

        //don't revert on signature failure: return SIG_VALIDATION_FAILED
        if (verifyingSigner != ECDSA.recover(hash, signature)) {
            return (abi.encode(userOp.getSender()), _packValidationData(true, validUntil, validAfter));
        }

        //no need for other on-chain validation: entire UserOp should have been checked
        // by the external service prior to signing it.
        return (abi.encode(userOp.getSender()), _packValidationData(false, validUntil, validAfter));
    }

    /**
     * Parse the paymaster and data field into its components
     * @param paymasterAndData The paymasterAndData field from UserOperation
     * @return validUntil Timestamp until which the signature is valid
     * @return validAfter Timestamp after which the signature is valid
     * @return signature The signature itself
     */
    function parsePaymasterAndData(bytes calldata paymasterAndData)
        public
        pure
        returns (uint48 validUntil, uint48 validAfter, bytes calldata signature)
    {
        (validUntil, validAfter) =
            abi.decode(paymasterAndData[VALID_TIMESTAMP_OFFSET:SIGNATURE_OFFSET], (uint48, uint48));
        signature = paymasterAndData[SIGNATURE_OFFSET:];
    }

    /**
     * Charge the user for the transaction
     * Called after the user's TX with mode==OpSucceeded|OpReverted
     * If the user's TX causes postOp to revert, it gets called again after
     * reverting the user's TX
     */
    function _postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) internal override {
        address sender = abi.decode(context, (address));
        uint256 charge = feeLogic.calculateFee(address(paymentToken), actualGasCost);
        //actualGasCost is known to be no larger than the above requiredPreFund, so the transfer should succeed.
        require(paymentToken.transferFrom(sender, address(this), charge), "EnclaveVerifyingTokenPaymaster: transfer failed");
    }

    /**
     * Manually swap collected tokens for ETH
     * This function can be called by the verifying signer
     * to convert accumulated tokens to ETH at an appropriate time
     * @param amount Amount of tokens to swap
     * @param slippage Slippage tolerance in 0.1% (e.g. 50 = 5.0%)
     * @param minExpectedOutput Minimum amount of wrapped native tokens expected from swap
     */
    function swapTokenForETH(uint256 amount, uint8 slippage, uint256 minExpectedOutput) external {
        require(msg.sender == verifyingSigner, "Only verifying signer can withdraw");
        require(amount > 0, "Amount must be greater than 0");
        require(slippage <= 100, "Slippage too high");
        require(minExpectedOutput > 0, "Minimum expected output must be greater than 0");
        require(paymentToken.balanceOf(address(this)) >= amount, "Insufficient token balance");

        // Set the configuration for this swap
        UniswapHelperConfig memory config = UniswapHelperConfig({
            minSwapAmount: 0,
            uniswapPoolFee: 3000, // 0.3% fee tier
            slippage: slippage
        });
        _setUniswapHelperConfiguration(config);
        
        // Perform the swap
        uint256 nativeReceived = swapToToken(
            address(paymentToken),
            address(wrappedNative),
            amount,
            minExpectedOutput,
            config.uniswapPoolFee
        );
        
        // Unwrap wrapped native token to native token if we received any
        if (nativeReceived > 0) {
            unwrapWeth(nativeReceived);
            
            // Emit success event with details
            emit SwapResult(
                true,
                "",  // No error message on success
                address(paymentToken),
                address(wrappedNative),
                amount,
                minExpectedOutput,
                nativeReceived,
                block.timestamp
            );
        } else {
            emit SwapResult(
                false,
                "Swap returned 0 tokens or failed",
                address(paymentToken),
                address(wrappedNative),
                amount,
                minExpectedOutput,
                0,
                block.timestamp
            );
            revert("Swap failed");
        }
    }

    /**
     * Withdraw tokens from the contract
     * @param token Address of the token to withdraw
     * @param to Address to send the tokens to
     * @param amount Amount of tokens to withdraw
     */
    function withdrawToken(address token, address to, uint256 amount) external {
        require(msg.sender == verifyingSigner, "Only verifying signer can withdraw");
        require(to != address(0), "Cannot withdraw to zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(token != address(0), "Invalid token address");
        
        IERC20 tokenContract = IERC20(token);
        require(tokenContract.balanceOf(address(this)) >= amount, "Insufficient token balance");
        require(tokenContract.transfer(to, amount), "Token transfer failed");
    }

    /**
     * Withdraw ETH from the contract
     * @param to Address to send the ETH to
     * @param amount Amount of ETH to withdraw
     */
    function withdrawETH(address payable to, uint256 amount) external {
        require(msg.sender == verifyingSigner, "Only verifying signer can withdraw");
        require(to != address(0), "Cannot withdraw to zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= amount, "Insufficient ETH balance");
        
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    /**
     * Overridden swapToToken function to capture swap failures
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input token to swap
     * @param amountOutMin Minimum amount of output token to accept
     * @param fee Uniswap pool fee tier
     * @return amountOut Amount of output token received
     */
    function swapToToken(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint24 fee
    ) internal override returns (uint256 amountOut) {
        // Call the parent implementation
        amountOut = super.swapToToken(tokenIn, tokenOut, amountIn, amountOutMin, fee);
        
        // If the swap failed, emit our custom event
        if (amountOut == 0) {
            emit SwapResult(
                false,
                "Uniswap swap failed",
                tokenIn,
                tokenOut,
                amountIn,
                amountOutMin,
                0,
                block.timestamp
            );
            // Explicitly revert on swap failure for better security
            revert("Swap returned zero tokens");
        }
        
        return amountOut;
    }

    // Allow contract to receive native token from unwrapping wrapped native token
    receive() external payable {}
}
