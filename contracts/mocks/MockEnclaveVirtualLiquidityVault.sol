// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockEnclaveVirtualLiquidityVault {
    address constant public NATIVE_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    bool public withdrawSuccess = true;

    function setWithdrawSuccess(bool _success) external {
        withdrawSuccess = _success;
    }

    function withdrawToken(address _tokenAddress, uint256 _amount) external returns (bool) {
        if (!withdrawSuccess) {
            revert("Withdrawal failed");
        }
        
        if (_tokenAddress == NATIVE_ADDRESS) {
            (bool success, ) = msg.sender.call{value: _amount}("");
            return success;
        }
        
        return true;
    }

    receive() external payable {}
    
    fallback() external payable {}
} 