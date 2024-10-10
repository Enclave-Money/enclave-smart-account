// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./P256SmartAccount.sol";

/**
 * A sample factory contract for SimpleAccount
 * A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 * This way, the entryPoint.getSenderAddress() can be called either before or after the account is created.
 */
contract P256SmartAccountFactory {
    P256SmartAccount public immutable accountImplementation;

    constructor() {
        accountImplementation = new P256SmartAccount();
    }

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(uint256[2] memory _pubkey, address enclaveRegistry, uint256 salt)
        public
        returns (P256SmartAccount ret)
    {
        address addr = getAccountAddress( _pubkey, enclaveRegistry, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return P256SmartAccount(payable(addr));
        }
        ret = P256SmartAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(P256SmartAccount.initialize, ( _pubkey,enclaveRegistry))
                )
            )
        );
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAccountAddress( uint256[2] memory _pubkey,  address enclaveRegistry, uint256 salt) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        address(accountImplementation),
                        abi.encodeCall(P256SmartAccount.initialize, ( _pubkey, enclaveRegistry))
                    )
                )
            )
        );
    }
}
