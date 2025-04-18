// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./SmartAccountV1.sol";

/**
 * A sample factory contract for SmartAccountV1
 * A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 * This way, the entryPoint.getSenderAddress() can be called either before or after the account is created.
 */
contract SmartAccountFactoryV1 {
    SmartAccountV1 public immutable accountImplementation;

    event AccountCreated(address scwAddress, address owner);

    constructor() {
        accountImplementation = new SmartAccountV1();
    }

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(
        address owner,
        address enclaveRegistry,
        bool smartBalanceEnabled,
        uint256 salt
    ) public returns (SmartAccountV1 ret) {
        if (owner == address(0) || enclaveRegistry == address(0)) revert ZeroAddressNotAllowed();
        
        address addr = getAccountAddress(owner, enclaveRegistry, smartBalanceEnabled, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return SmartAccountV1(payable(addr));
        }
        ret = SmartAccountV1(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(SmartAccountV1.initialize, (owner, enclaveRegistry, smartBalanceEnabled))
                )
            )
        );

        emit AccountCreated(addr, owner);
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAccountAddress(
        address owner,
        address enclaveRegistry,
        bool smartBalanceEnabled,
        uint256 salt
    ) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        address(accountImplementation),
                        abi.encodeCall(SmartAccountV1.initialize, (owner, enclaveRegistry, smartBalanceEnabled))
                    )
                )
            )
        );
    }
}
