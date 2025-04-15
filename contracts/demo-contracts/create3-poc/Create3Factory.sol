// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../utils-contracts/CREATE3.sol";
import "./Create3Proxy.sol";

/**
 * @title Create3Factory
 * @notice A factory contract that deploys upgradeable contracts using CREATE3
 * @dev Uses CREATE3 library to deploy custom proxies with deterministic addresses
 */
contract Create3Factory {
    // Event emitted when a new proxy is deployed
    event ProxyDeployed(address indexed implementation, address indexed proxy, bytes32 salt);
    
    /**
     * @notice Deploys a new proxy to a deterministic address using CREATE3
     * @param implementation Address of the implementation contract
     * @param initData Initialization data to be passed to the proxy during construction
     * @param salt Unique value to determine the address of the contract
     * @return proxy Address of the deployed proxy
     */
    function deployProxy(
        address implementation,
        bytes memory initData,
        bytes32 salt
    ) external returns (address proxy) {
        // Create the proxy creation code
        bytes memory proxyCreationCode = abi.encodePacked(
            type(Create3Proxy).creationCode,
            abi.encode(implementation, initData)
        );
        
        // Deploy the proxy using CREATE3
        proxy = CREATE3.deploy(salt, proxyCreationCode, 0);
        
        emit ProxyDeployed(implementation, proxy, salt);
        return proxy;
    }
    
    /**
     * @notice Predicts the address where a contract will be deployed using CREATE3
     * @param salt Unique value to determine the address
     * @return predicted Address of the contract that would be deployed
     */
    function predictProxyAddress(bytes32 salt) external view returns (address predicted) {
        return CREATE3.getDeployed(salt);
    }
    
    /**
     * @notice Generates a human-readable salt from a string
     * @param name String to generate salt from
     * @return salt The generated salt
     */
    function generateSalt(string memory name) external pure returns (bytes32 salt) {
        return keccak256(abi.encodePacked(name));
    }
} 