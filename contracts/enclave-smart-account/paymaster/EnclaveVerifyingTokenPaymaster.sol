// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */
/* solhint-disable no-inline-assembly */

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IEnclaveFeeLogic.sol";
import "./UniswapHelper.sol";
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

contract EnclaveVerifyingTokenPaymaster is BasePaymaster, UniswapHelper {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    event FeeLogicUpdated(address indexed oldFeeLogic, address indexed newFeeLogic, uint256 timestamp);
    event PaymentTokenUpdated(address indexed oldPaymentToken, address indexed newPaymentToken, uint256 timestamp);
    
    // Unified swap events for both success and failures
    event SwapResult(
        bool success,             // Whether the swap was successful
        string reason,            // Description/reason (empty on success, error message on failure)
        address tokenIn,          // Source token
        address tokenOut,         // Destination token
        uint256 amountIn,         // Input amount
        uint256 amountOutMin,     // Minimum expected output
        uint256 amountOut,        // Actual output (0 on failure)
        uint256 timestamp         // When the swap occurred
    );
    
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate, uint256 timestamp, uint256 rateAge);
    event SwapDisabled(string reason, uint256 timestamp);
    event SwapEnabled(uint256 timestamp);

    address public immutable verifyingSigner;

    uint256 private constant VALID_TIMESTAMP_OFFSET = 20;

    uint256 private constant SIGNATURE_OFFSET = 84;
    uint256 private constant MIN_NATIVE_RECEIVED = 1e15; // 0.001 ETH in wei

    ERC20 public paymentToken;
    IEnclaveFeeLogic public feeLogic;
    
    bool public swapTokensToNative = true;
    uint8 public swapSlippage = 50; // 5.0% default slippage
    
    // Token-to-native conversion rate, updated by the verifying signer
    // Using a fixed-point representation: 1 token = exchangeRate / RATE_DENOMINATOR native tokens
    uint256 public exchangeRate;
    uint256 public constant RATE_DENOMINATOR = 1e18;
    uint256 public lastRateUpdate;
    uint256 public maxRateAge = 1 days; // Maximum age for exchange rate before it's considered stale

    constructor(
        IEntryPoint _entryPoint,
        address _verifyingSigner,
        address _paymentToken, 
        address _feeLogicContract,
        address _wrappedNative,
        address _uniswapRouter,
        uint256 _initialExchangeRate
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
        exchangeRate = _initialExchangeRate;
        lastRateUpdate = block.timestamp;
    }

    function updateFeeLogic(address _feeLogicContract) external onlyOwner {
        feeLogic = IEnclaveFeeLogic(_feeLogicContract);
        emit FeeLogicUpdated(address(feeLogic), _feeLogicContract, block.timestamp);
    }

    function updatePaymentToken(address _paymentToken) external onlyOwner {
        paymentToken = ERC20(_paymentToken);
        emit PaymentTokenUpdated(address(paymentToken), _paymentToken, block.timestamp);
    }
    
    function setSwapTokensToNative(bool _swapTokensToNative) external onlyOwner {
        if (_swapTokensToNative == swapTokensToNative) return;
        
        swapTokensToNative = _swapTokensToNative;
        
        if (_swapTokensToNative) {
            emit SwapEnabled(block.timestamp);
        } else {
            emit SwapDisabled("Disabled by owner", block.timestamp);
        }
    }
    
    function setSwapSlippage(uint8 _swapSlippage) external onlyOwner {
        require(_swapSlippage <= 100, "Slippage too high");
        swapSlippage = _swapSlippage;
    }
    
    function setMaxRateAge(uint256 _maxRateAge) external onlyOwner {
        require(_maxRateAge >= 1 hours, "Rate age too short");
        require(_maxRateAge <= 7 days, "Rate age too long");
        maxRateAge = _maxRateAge;
    }
    
    /**
     * Updates the token-to-native exchange rate
     * This should be called regularly by the verifying signer with
     * off-chain data from Uniswap or other price oracles
     */
    function updateExchangeRate(uint256 _newRate) external virtual onlyOwner {
        require(_newRate > 0, "Exchange rate cannot be zero");      
    
        // Update exchange rate and nonce
        uint256 oldRate = exchangeRate;
        exchangeRate = _newRate;
        lastRateUpdate = block.timestamp;
        
        emit ExchangeRateUpdated(oldRate, _newRate, block.timestamp, block.timestamp - lastRateUpdate);
    }
    
    /**
     * Checks if the current exchange rate is fresh enough to use
     */
    function isExchangeRateValid() public view returns (bool) {
        return block.timestamp - lastRateUpdate < maxRateAge;
    }
    
    /**
     * Estimates the amount of native tokens received for a given amount of tokens
     * Based on the latest exchange rate, with slippage applied
     */
    function estimateNativeTokenOutput(uint256 tokenAmount) public view returns (uint256) {
        // Calculate expected output based on current exchange rate
        uint256 expectedOutput = (tokenAmount * exchangeRate) / RATE_DENOMINATOR;
        
        // Apply slippage tolerance - reduce expected output by slippage percentage
        return (expectedOutput * (1000 - swapSlippage)) / 1000;
    }

    mapping(address => uint256) public senderNonce;

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
     * verify our external signer signed this request.
     * the "paymasterAndData" is expected to be the paymaster and a signature over the entire request params
     * paymasterAndData[:20] : address(this)
     * paymasterAndData[20:84] : abi.encode(validUntil, validAfter)
     * paymasterAndData[84:] : signature
     */
    function _validatePaymasterUserOp(UserOperation calldata userOp, bytes32, /*userOpHash*/ uint256 requiredPreFund)
        internal
        override
        returns (bytes memory context, uint256 validationData)
    {
        (requiredPreFund);

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
     * actual charge of user.
     * this method will be called just after the user's TX with mode==OpSucceeded|OpReverted (account pays in both cases)
     * BUT: if the user changed its balance in a way that will cause  postOp to revert, then it gets called again, after reverting
     * the user's TX , back to the state it was before the transaction started (before the validatePaymasterUserOp),
     * and the transaction should succeed there.
     */
    function _postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) internal override {
        //we don't really care about the mode, we just pay the gas with the user's tokens.
        (mode);
        console.log("EnclaveVerifyingTokenPaymaster");
        address sender = abi.decode(context, (address));
        uint256 charge = feeLogic.calculateFee(address(paymentToken) ,actualGasCost);
        //actualGasCost is known to be no larger than the above requiredPreFund, so the transfer should succeed.
        require(paymentToken.transferFrom(sender, address(this), charge), "EnclaveVerifyingTokenPaymaster: transfer failed");
        
        // If swapping is enabled, swap collected tokens for native token
        if (swapTokensToNative) {
            // Check if exchange rate is valid or if we should disable swapping
            if (!isExchangeRateValid()) {
                emit SwapResult(
                    false,
                    "Exchange rate is stale",
                    address(paymentToken),
                    address(wrappedNative),
                    charge,
                    0,
                    0,
                    block.timestamp
                );
                return;
            }
            
            // Set the slippage for this swap
            UniswapHelperConfig memory config = UniswapHelperConfig({
                minSwapAmount: 0,
                uniswapPoolFee: 3000, // 0.3% fee tier
                slippage: swapSlippage
            });
            _setUniswapHelperConfiguration(config);
            
            // Calculate minimum expected output based on current exchange rate with slippage
            uint256 minExpectedOutput = estimateNativeTokenOutput(charge);
            
            // Only swap if the expected output meets our minimum threshold
            if (minExpectedOutput > MIN_NATIVE_RECEIVED) {
                // Perform the swap - using the exchange rate to set expectations
                // This will apply slippage protection internally in the UniswapHelper
                uint256 nativeReceived = swapToToken(
                    address(paymentToken),
                    address(wrappedNative),
                    charge,
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
                        charge,
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
                        charge,
                        minExpectedOutput,
                        0,
                        block.timestamp
                    );
                }
            } else {
                emit SwapResult(
                    false,
                    "Expected output below minimum threshold",
                    address(paymentToken),
                    address(wrappedNative),
                    charge,
                    minExpectedOutput,
                    0,
                    block.timestamp
                );
            }
        }
    }

    function withdrawTokens(address _to, uint256 _amount) external virtual {
        require(msg.sender == verifyingSigner, "Only verifying signer can withdraw");
        require(paymentToken.transfer(_to, _amount), "EnclaveVerifyingTokenPaymaster: withdraw failed");
    }
    
    function withdrawNative(address payable _to, uint256 _amount) external {
        require(msg.sender == verifyingSigner, "Only verifying signer can withdraw");
        require(_to != address(0), "Cannot withdraw to zero address");
        require(address(this).balance >= _amount, "Insufficient native token balance");
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "Native token transfer failed");
    }
    
    /**
     * Emergency function to handle tokens that were accidentally sent to the contract
     */
    function rescueERC20(address tokenAddress, address to, uint256 amount) external onlyOwner {
        require(tokenAddress != address(paymentToken), "Cannot rescue payment token");
        require(to != address(0), "Cannot rescue to zero address");
        IERC20 token = IERC20(tokenAddress);
        require(token.transfer(to, amount), "Token rescue failed");
    }
    
    // Allow contract to receive native token from unwrapping wrapped native token
    receive() external payable {}
    
    // Special handler for the UniswapHelper's event
    // This will use our custom event format to capture failures from UniswapHelper
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
        }
        
        return amountOut;
    }
}
