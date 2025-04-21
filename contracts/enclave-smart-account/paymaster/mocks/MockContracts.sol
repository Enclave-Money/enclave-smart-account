// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../EnclaveVerifyingTokenPaymaster.sol";
import "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// Mock ERC20 token
contract MockERC20 is ERC20 {
  constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
  
  function mint(address account, uint256 amount) external {
    _mint(account, amount);
  }
}

// Mock WETH token
contract MockWETH {
  string public name = "Wrapped ETH";
  string public symbol = "WETH";
  uint8 public decimals = 18;
  
  event Deposit(address indexed dst, uint wad);
  event Withdrawal(address indexed src, uint wad);
  event Transfer(address indexed src, address indexed dst, uint wad);
  event Approval(address indexed src, address indexed guy, uint wad);
  
  mapping (address => uint) public balanceOf;
  mapping (address => mapping (address => uint)) public allowance;
  
  receive() external payable {
    deposit();
  }
  
  function deposit() public payable {
    balanceOf[msg.sender] += msg.value;
    emit Deposit(msg.sender, msg.value);
  }
  
  function withdraw(uint wad) public {
    require(balanceOf[msg.sender] >= wad);
    balanceOf[msg.sender] -= wad;
    payable(msg.sender).transfer(wad);
    emit Withdrawal(msg.sender, wad);
  }
  
  function totalSupply() public view returns (uint) {
    return address(this).balance;
  }
  
  function approve(address guy, uint wad) public returns (bool) {
    allowance[msg.sender][guy] = wad;
    emit Approval(msg.sender, guy, wad);
    return true;
  }
  
  function transfer(address dst, uint wad) public returns (bool) {
    return transferFrom(msg.sender, dst, wad);
  }
  
  function transferFrom(address src, address dst, uint wad) public returns (bool) {
    require(balanceOf[src] >= wad);
    
    if (src != msg.sender && allowance[src][msg.sender] != type(uint).max) {
      require(allowance[src][msg.sender] >= wad);
      allowance[src][msg.sender] -= wad;
    }
    
    balanceOf[src] -= wad;
    balanceOf[dst] += wad;
    
    emit Transfer(src, dst, wad);
    
    return true;
  }
}

// Mock Uniswap V3 Factory
contract MockUniswapV3Factory {
  address public pool;
  
  function setPool(address _pool) external {
    pool = _pool;
  }
  
  function getPool(address, address, uint24) external view returns (address) {
    return pool;
  }
}

// Mock Uniswap V3 Pool
contract MockUniswapV3Pool {
  uint160 public sqrtPriceX96;
  uint128 public liquidity;
  address public token0;
  address public token1;
  
  function setSqrtPriceX96(uint160 _sqrtPriceX96) external {
    sqrtPriceX96 = _sqrtPriceX96;
  }
  
  function setLiquidity(uint128 _liquidity) external {
    liquidity = _liquidity;
  }
  
  function setTokens(address _token0, address _token1) external {
    token0 = _token0;
    token1 = _token1;
  }
  
  function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool) {
    return (sqrtPriceX96, 0, 0, 0, 0, 0, false);
  }
}

// Mock Swap Router
contract MockSwapRouter {
  address public immutable WETH9;
  
  constructor(address _WETH9) {
    WETH9 = _WETH9;
  }
  
  struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
  }
  
  function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut) {
    // Mocking a successful swap
    if (params.tokenOut == WETH9) {
      // If swapping to WETH, return 1:1 (plus fees)
      amountOut = params.amountIn * 995 / 1000; // 0.5% fee
      
      // Use low-level call instead of direct cast to avoid type errors
      (bool success, ) = WETH9.call(
        abi.encodeWithSignature(
          "transfer(address,uint256)", 
          params.recipient, 
          amountOut
        )
      );
      require(success, "Transfer failed");
    } else {
      // Some other token
      amountOut = params.amountIn * 995 / 1000; // 0.5% fee
    }
    
    return amountOut;
  }
  
  function unwrapWETH9(uint256 amountMinimum, address recipient) external {
    // Use low-level call to withdraw
    (bool success1, ) = WETH9.call(
      abi.encodeWithSignature("withdraw(uint256)", amountMinimum)
    );
    require(success1, "Withdraw failed");
    
    // Transfer ETH to recipient
    (bool success2, ) = payable(recipient).call{value: amountMinimum}("");
    require(success2, "ETH transfer failed");
  }
  
  // To receive ETH when unwrapping WETH
  receive() external payable {}
}

// Mock Fee Logic
contract MockEnclaveFeeLogic {
  function calculateFee(address token, uint256 actualGasCost) external pure returns (uint256) {
    // Simply return gas cost multiplied by a factor for testing
    return actualGasCost * 2;
  }
}

// This contract adapts between the 4-param constructor expected in tests
// and the 7-param constructor required by the real contract
contract MockTokenPaymasterAdapter {
    MockEnclaveVerifyingTokenPaymaster public paymaster;
    
    constructor(
        IEntryPoint _entryPoint,
        address _verifyingSigner,
        address _paymentToken,
        address _feeLogicContract,
        address _wrappedNative,
        address _uniswapRouter
    ) {
        paymaster = new MockEnclaveVerifyingTokenPaymaster(
            _entryPoint,
            _verifyingSigner,
            _paymentToken,
            _feeLogicContract,
            _wrappedNative,
            _uniswapRouter
        );
        
        // Set the paymaster to skip signature validation for testing
        paymaster.setSkipSignatureValidation(true);
    }

    // Forward key properties
    function entryPoint() external view returns (IEntryPoint) {
        return paymaster.entryPoint();
    }
    
    function getPaymasterAddress() external view returns (address) {
        return address(paymaster);
    }
    
    function verifyingSigner() external view returns (address) {
        return paymaster.verifyingSigner();
    }
    
    function paymentToken() external view returns (ERC20) {
        return paymaster.paymentToken();
    }
    
    function feeLogic() external view returns (address) {
        return address(paymaster.feeLogic());
    }
    
    // Forward key functions
    function addStake(uint32 unstakeDelaySec) external payable {
        paymaster.addStake{value: msg.value}(unstakeDelaySec);
    }
    
    function withdrawTokens(address to, uint256 amount) external {
        address tokenAddress = address(paymaster.paymentToken());
        paymaster.withdrawToken(tokenAddress, to, amount);
    }
    
    function updateFeeLogic(address _feeLogicContract) external {
        paymaster.updateFeeLogic(_feeLogicContract);
    }
    
    function updatePaymentToken(address _paymentToken) external {
        paymaster.updatePaymentToken(_paymentToken);
    }
    
    // Delegate all calls to the real paymaster
    fallback() external payable {
        address _paymaster = address(paymaster);
        
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas(), _paymaster, ptr, calldatasize(), 0, 0)
            let size := returndatasize()
            returndatacopy(ptr, 0, size)
            
            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
    }
    
    receive() external payable {
        (bool success,) = address(paymaster).call{value: msg.value}("");
        require(success, "ETH transfer failed");
    }
}

// Mock malicious contract for security testing
contract MockMaliciousContract {
  address public runner;
  
  constructor() {
    runner = msg.sender;
  }
  
  function getRunner() external view returns (address) {
    return runner;
  }
  
  receive() external payable {
    // Try to re-enter here
  }
}

// Added EntryPoint for testing
contract MockEntryPoint {
  mapping(address => uint256) private deposits;
  mapping(address => uint256) private stakes;
  
  function depositTo(address account) external payable {
    deposits[account] += msg.value;
  }
  
  function balanceOf(address account) external view returns (uint256) {
    return deposits[account];
  }
  
  function addStake(uint32 unstakeDelaySec) external payable {
    stakes[msg.sender] += msg.value;
  }
  
  function unlockStake() external {
    // Just a mock implementation - no real unlocking
  }
  
  function withdrawStake(address payable withdrawAddress) external {
    uint256 amount = stakes[msg.sender];
    if (amount > 0) {
      stakes[msg.sender] = 0;
      withdrawAddress.transfer(amount);
    }
  }
  
  // To receive ETH when testing
  receive() external payable {}
}

contract MockEnclaveVerifyingTokenPaymaster is EnclaveVerifyingTokenPaymaster {
    bool public skipSignatureValidation;

    constructor(
        IEntryPoint _entryPoint,
        address _verifyingSigner,
        address _paymentToken,
        address _feeLogicContract,
        address _wrappedNative,
        address _uniswapRouter
    ) EnclaveVerifyingTokenPaymaster(
        _entryPoint,
        _verifyingSigner,
        _paymentToken,
        _feeLogicContract,
        _wrappedNative,
        _uniswapRouter
    ) {
        skipSignatureValidation = false;
    }

    function setSkipSignatureValidation(bool _skip) external {
        skipSignatureValidation = _skip;
    }

    // Overridden for testing
    function updateExchangeRate(uint256 _newRate) external {
        // This function is kept for test compatibility, but now it's a no-op since
        // the main contract no longer has this function
    }

    // Simplified for testing - no override keyword since this function doesn't exist in the parent contract
    function withdrawTokens(address _to, uint256 _amount) external {
        if (!skipSignatureValidation) {
            require(msg.sender == verifyingSigner, "Only verifying signer can withdraw");
        }
        require(paymentToken.transfer(_to, _amount), "EnclaveVerifyingTokenPaymaster: withdraw failed");
    }
} 