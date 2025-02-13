// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./EnclaveVirtualLiquidityVault.sol";

/**
 * @title EnclaveVirtualLiquidityVaultFactory
 * @author Enclave HK Limited
 * @notice Factory contract to deploy EnclaveVirtualLiquidityVault with ERC1967 proxies
 */
contract EnclaveVirtualLiquidityVaultFactory {
    EnclaveVirtualLiquidityVault public immutable vaultImplementation;
    
    event VaultDeployed(address vaultAddress, address manager);

    constructor(IEntryPoint _entryPoint) {
        vaultImplementation = new EnclaveVirtualLiquidityVault(_entryPoint);
    }

    /**
     * @notice Creates a new vault and returns its address
     * @param _manager The manager address for the new vault
     * @param _socket The socket address for cross-chain communication
     * @param _inboundSb The inbound switchboard address
     * @param _outboundSb The outbound switchboard address
     * @param _entryPoint The EntryPoint contract address
     * @param _salt Unique salt for deterministic deployment
     * @return vault The address of the newly deployed vault
     */
    function createVault(
        address _manager,
        address _socket,
        address _inboundSb,
        address _outboundSb,
        IEntryPoint _entryPoint,
        uint256 _salt
    ) external returns (EnclaveVirtualLiquidityVault vault) {
        address addr = getVaultAddress(_manager, _socket, _inboundSb, _outboundSb, _entryPoint, _salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return EnclaveVirtualLiquidityVault(payable(addr));
        }

        vault = EnclaveVirtualLiquidityVault(
            payable(
                new ERC1967Proxy{salt: bytes32(_salt)}(
                    address(vaultImplementation),
                    abi.encodeCall(
                        EnclaveVirtualLiquidityVault.initialize,
                        (_manager, _socket, _inboundSb, _outboundSb, _entryPoint)
                    )
                )
            )
        );

        emit VaultDeployed(address(vault), _manager);
    }

    /**
     * @notice Calculates the deterministic address for a vault before it is deployed
     * @param _manager The manager address for the new vault
     * @param _socket The socket address for cross-chain communication
     * @param _inboundSb The inbound switchboard address
     * @param _outboundSb The outbound switchboard address
     * @param _entryPoint The EntryPoint contract address
     * @param _salt Unique salt for deterministic deployment
     * @return The calculated address of the vault
     */
    function getVaultAddress(
        address _manager,
        address _socket,
        address _inboundSb,
        address _outboundSb,
        IEntryPoint _entryPoint,
        uint256 _salt
    ) public view returns (address) {
        return Create2.computeAddress(
            bytes32(_salt),
            keccak256(
                abi.encodePacked(
                    type(ERC1967Proxy).creationCode,
                    abi.encode(
                        address(vaultImplementation),
                        abi.encodeCall(
                            EnclaveVirtualLiquidityVault.initialize,
                            (_manager, _socket, _inboundSb, _outboundSb, _entryPoint)
                        )
                    )
                )
            )
        );
    }
} 