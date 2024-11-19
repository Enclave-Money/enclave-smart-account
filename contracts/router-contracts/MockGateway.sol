// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockGateway {
    function setDappMetadata(string memory) external pure returns (bool) {
        return true;
    }
}