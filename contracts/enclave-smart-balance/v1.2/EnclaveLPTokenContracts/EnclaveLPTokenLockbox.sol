// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "../../../xERC20-contracts/XERC20Lockbox.sol";

contract EnclaveLPTokenLockbox is XERC20Lockbox {
    constructor(address _xerc20, address _erc20, bool _isNative) 
        XERC20Lockbox(_xerc20, _erc20, _isNative) {}
}
