// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract P256VerifierYul {

    address private immutable verifierContract;

    constructor(address _verifierContract) {
        verifierContract = _verifierContract;
    }

    function ecdsa_verify(bytes32 hash, uint256 r, uint256 s, uint256[2] memory pubKey) public view returns (bool) {
        bytes32 input;
        bool success;
        bytes32 result;

        uint256 x = pubKey[0];
        uint256 y = pubKey[1];

        address yulAddress = verifierContract;

        assembly {
            // Store the function selector for "verify(bytes32,uint256,uint256,uint256,uint256)"
            mstore(input, hash)
            mstore(add(input, 32), r)
            mstore(add(input, 64), s)
            mstore(add(input, 96), x)
            mstore(add(input, 128), y)

            // Call the precompile
            success := staticcall(gas(), sload(yulAddress), input, 160, result, 32)
        }

        require(success, "P256 verify call failed");

        return result[31] == 0x01;
    }

    fallback(bytes calldata input) external returns (bytes memory) {
        if (input.length != 160) {
            return abi.encodePacked(uint256(0));
        }

        bytes32 hash = bytes32(input[0:32]);
        uint256 r = uint256(bytes32(input[32:64]));
        uint256 s = uint256(bytes32(input[64:96]));
        uint256 x = uint256(bytes32(input[96:128]));
        uint256 y = uint256(bytes32(input[128:160]));

        uint256 ret = ecdsa_verify(hash, r, s, [x, y]) ? 1 : 0;

        return abi.encodePacked(ret);
    }
}