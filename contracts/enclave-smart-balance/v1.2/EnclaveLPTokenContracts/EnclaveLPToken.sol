// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;
/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */

import "../../../xERC20-contracts/XERC20.sol";

contract EnclaveLPToken is XERC20 {
    address public vault;

    constructor (
        string memory _name, 
        string memory _symbol, 
        address _factory,
        address _vault
    ) XERC20 (_name, _symbol, _factory) {
        vault = _vault;
    }

    // Override the mint function
    function mint(address to, uint256 amount) public override {
        if (msg.sender == vault) {
            _mint(to, amount);
        } else {
            // Execute the pre-existing logic
            _mintWithCaller(msg.sender, to, amount);
        }
    }
}
