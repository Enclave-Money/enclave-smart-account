// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "hardhat/console.sol";

contract P256V {
    address public precompile;

    constructor (address _precompile) {
        precompile = _precompile;
    }

    function verify(
        bytes32 message_hash,
        uint256 r,
        uint256 s,
        uint256[2] memory pubKey
    ) public view returns (bool) {
        bytes memory publicKey = abi.encodePacked(pubKey[0], pubKey[1]);
        bytes memory signature = abi.encodePacked(r, s);
        bytes memory input = abi.encodePacked(message_hash, signature, publicKey);
            
        (bool success, bytes memory output) = precompile.staticcall(input);

        require(success, "Verification failed");
        return abi.decode(output, (bool));
    }
}