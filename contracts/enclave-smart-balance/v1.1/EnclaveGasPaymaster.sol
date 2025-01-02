// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */
/* solhint-disable no-inline-assembly */

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract EnclaveGasPaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    address public immutable verifyingSigner;

    uint256 private constant VALID_TIMESTAMP_OFFSET = 20;

    uint256 private constant SIGNATURE_OFFSET = 84;

    // Modified state variables
    mapping(bytes32 => uint256) public organizationBalances;
    mapping(bytes32 => bool) public registeredOrganizations;
    mapping(bytes32 => address) public orgToSigningAddress;
    mapping(bytes32 => address) public orgToFundingAddress;
    mapping(address => bytes32) public signingAddressToOrg;
    mapping(address => bytes32) public fundingAddressToOrg;

    // Add new mapping for funding address nonces
    mapping(address => uint256) public fundingAddressNonces;

    // Modified events
    event OrganizationRegistered(
        bytes32 indexed orgId, 
        address indexed signingAddress, 
        address indexed fundingAddress
    );
    event OrganizationDeposit(bytes32 indexed orgId, uint256 amount);
    event OrganizationWithdrawal(bytes32 indexed orgId, uint256 amount);
    event TransactionSponsored(bytes32 indexed orgId, address indexed sender, uint256 actualGasCost);

    constructor(IEntryPoint _entryPoint, address _verifyingSigner) BasePaymaster(_entryPoint) {
        verifyingSigner = _verifyingSigner;
    }

    mapping(address => uint256) public senderNonce;

    // Add function to get registration hash
    function getRegistrationHash(
        bytes32 orgId,
        address fundingAddress,
        address signingAddress
    ) public view returns (bytes32) {
        return keccak256(abi.encode(
            orgId,
            fundingAddress,
            signingAddress,
            fundingAddressNonces[fundingAddress]
        ));
    }

    // Modified registration function
    function registerOrganization(
        bytes calldata _data,
        bytes calldata _signature
    ) external onlyOwner {
        // Decode organization data
        (bytes32 orgId, address fundingAddress, address signingAddress) = abi.decode(_data, (bytes32, address, address));

        bool isReg = registeredOrganizations[orgId];
        // Include nonce in message hash
        bytes32 messageHash = getRegistrationHash(orgId, fundingAddress, signingAddress);
        bytes32 signedHash = ECDSA.toEthSignedMessageHash(messageHash);
        
        require(fundingAddress == ECDSA.recover(signedHash, _signature), "Invalid signature");

        // Increment nonce after successful verification
        fundingAddressNonces[fundingAddress]++;

        registeredOrganizations[orgId] = true;
        orgToSigningAddress[orgId] = signingAddress;
        orgToFundingAddress[orgId] = fundingAddress;
        signingAddressToOrg[signingAddress] = orgId;
        fundingAddressToOrg[fundingAddress] = orgId;
        
        emit OrganizationRegistered(orgId, signingAddress, fundingAddress);
    }

    // Update the updateOrgSigningAddress function
    function updateOrgSigningAddress(
        bytes32 _orgId,
        address _newSigningAddress
    ) external {
        require(msg.sender == owner() || msg.sender == verifyingSigner, "Unauthorized");
        orgToSigningAddress[_orgId] = _newSigningAddress;
        signingAddressToOrg[_newSigningAddress] = _orgId;
    }

    // Override deposit to handle organization deposits
    function deposit() public payable override {
        bytes32 orgId = fundingAddressToOrg[msg.sender];
        require(orgId != bytes32(0), "Not a registered funding address");
        
        organizationBalances[orgId] += msg.value;
        entryPoint.depositTo{value : msg.value}(address(this));
        
        emit OrganizationDeposit(orgId, msg.value);
    }

    // Override withdrawTo to handle organization withdrawals
    function withdrawTo(address payable withdrawAddress, uint256 amount) public override {
        bytes32 orgId = fundingAddressToOrg[msg.sender];
        require(orgId != bytes32(0), "Not a registered funding address");
        require(organizationBalances[orgId] >= amount, "Insufficient organization balance");
        
        organizationBalances[orgId] -= amount;
        entryPoint.withdrawTo(withdrawAddress, amount);
        
        emit OrganizationWithdrawal(orgId, amount);
    }

    function getOrgDeposit(bytes32 _orgId) public view returns (uint256) {
        require(registeredOrganizations[_orgId], "Organization not registered");
        return organizationBalances[_orgId];
    }

    function pack(UserOperation calldata userOp) internal pure returns (bytes memory ret) {
        address sender = userOp.sender;
        uint256 nonce = userOp.nonce;
        bytes32 hashInitCode = calldataKeccak(userOp.initCode);
        bytes32 hashCallData = calldataKeccak(userOp.callData);
        uint256 callGasLimit = userOp.callGasLimit;
        uint256 verificationGasLimit = userOp.verificationGasLimit;
        uint256 preVerificationGas = userOp.preVerificationGas;
        uint256 maxFeePerGas = userOp.maxFeePerGas;
        uint256 maxPriorityFeePerGas = userOp.maxPriorityFeePerGas;

        return abi.encode(
            sender,
            nonce,
            hashInitCode,
            hashCallData,
            callGasLimit,
            verificationGasLimit,
            preVerificationGas,
            maxFeePerGas,
            maxPriorityFeePerGas
        );
    }

    /**
     * return the hash we're going to sign off-chain (and validate on-chain)
     * this method is called by the off-chain service, to sign the request.
     * it is called on-chain from the validatePaymasterUserOp, to validate the signature.
     * note that this signature covers all fields of the UserOperation, except the "paymasterAndData",
     * which will carry the signature itself.
     */
    function getHash(UserOperation calldata userOp, uint48 validUntil, uint48 validAfter)
        public
        view
        returns (bytes32)
    {
        //can't use userOp.hash(), since it contains also the paymasterAndData itself.

        return keccak256(
            abi.encode(
                pack(userOp), block.chainid, address(this), senderNonce[userOp.getSender()], validUntil, validAfter
            )
        );
    }

    // Modified validation function to use orgId
    function _validatePaymasterUserOp(UserOperation calldata userOp, bytes32, uint256 requiredPreFund)
        internal
        override
        returns (bytes memory context, uint256 validationData)
    {
        (requiredPreFund);

        (uint48 validUntil, uint48 validAfter, bytes32 orgId, bytes calldata signature) =
            parsePaymasterAndData(userOp.paymasterAndData);

        require(registeredOrganizations[orgId], "Organization not registered");
        require(organizationBalances[orgId] >= requiredPreFund, "Insufficient organization balance");

        bytes32 hash = ECDSA.toEthSignedMessageHash(getHash(userOp, validUntil, validAfter));
        senderNonce[userOp.getSender()]++;

        if (orgToSigningAddress[orgId] != ECDSA.recover(hash, signature)) {
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        return (abi.encode(orgId), _packValidationData(false, validUntil, validAfter));
    }

    // Modified parsing function
    function parsePaymasterAndData(bytes calldata paymasterAndData)
        public
        pure
        returns (uint48 validUntil, uint48 validAfter, bytes32 orgId, bytes calldata signature)
    {
        (validUntil, validAfter, orgId) =
            abi.decode(paymasterAndData[VALID_TIMESTAMP_OFFSET:SIGNATURE_OFFSET], (uint48, uint48, bytes32));
        signature = paymasterAndData[SIGNATURE_OFFSET:];
    }

    // Modified postOp function
    function _postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) internal override {
        if (mode == PostOpMode.postOpReverted) {
            return;
        }
        
        bytes32 orgId = abi.decode(context, (bytes32));
        organizationBalances[orgId] -= actualGasCost;
        emit TransactionSponsored(orgId, msg.sender, actualGasCost);
    }
}