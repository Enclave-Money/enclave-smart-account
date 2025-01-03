// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */
/* solhint-disable no-inline-assembly */

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "hardhat/console.sol";

contract EnclaveGasPaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    uint256 private constant VALID_TIMESTAMP_OFFSET = 20;

    uint256 private constant SIGNATURE_OFFSET = 116;

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
    event OrganizationSigningAddressUpdated(
        bytes32 indexed orgId,
        address indexed oldSigningAddress,
        address indexed newSigningAddress
    );
    event OrganizationFundingAddressUpdated(
        bytes32 indexed orgId,
        address indexed oldFundingAddress,
        address indexed newFundingAddress
    );

    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    mapping(address => uint256) public senderNonce;

    // Add function to get registration hash
    function getRegistrationHash(
        bytes32 orgId,
        address fundingAddress,
        address signingAddress
    ) public view returns (bytes32) {
        console.log("Getting registration hash for:");
        console.log("  orgId:", uint256(orgId));
        console.log("  fundingAddress:", fundingAddress);
        console.log("  signingAddress:", signingAddress);
        console.log("  nonce:", fundingAddressNonces[fundingAddress]);
        
        bytes32 hash = keccak256(abi.encode(
            orgId,
            fundingAddress,
            signingAddress,
            fundingAddressNonces[fundingAddress]
        ));
        console.log("Calculated hash:", uint256(hash));
        return hash;
    }

    // Modified registration function
    function registerOrganization(
        bytes32 orgId,
        address signingAddress
    ) external {
        console.log("Registering organization");
        
        // Prevent duplicate registrations
        require(!registeredOrganizations[orgId], "Organization ID already registered");
        require(signingAddress != address(0), "Invalid address");
        
        // Prevent duplicate funding and signing addresses
        require(fundingAddressToOrg[msg.sender] == bytes32(0), "Funding address already in use");
        require(signingAddressToOrg[signingAddress] == bytes32(0), "Signing address already in use");
        
        // Decode organization data
        console.log("Decoded data:");
        console.log("  orgId:", uint256(orgId));
        console.log("  fundingAddress:", msg.sender);
        console.log("  signingAddress:", signingAddress);

        console.log("Setting organization mappings");
        registeredOrganizations[orgId] = true;
        orgToSigningAddress[orgId] = signingAddress;
        orgToFundingAddress[orgId] = msg.sender;
        signingAddressToOrg[signingAddress] = orgId;
        fundingAddressToOrg[msg.sender] = orgId;
        
        emit OrganizationRegistered(orgId, signingAddress, msg.sender);
    }

    function updateOrgFundingAddress(
        address newFundingAddress
    ) external {
        require(newFundingAddress != address(0), "Invalid address");
        require(fundingAddressToOrg[newFundingAddress] == bytes32(0), "Funding address already registered");

        bytes32 orgId = fundingAddressToOrg[msg.sender];

        require(orgId != bytes32(0), "Sender not valid funding address");

        // Clear old mapping before setting new one
        delete fundingAddressToOrg[msg.sender];
        orgToFundingAddress[orgId] = newFundingAddress;
        fundingAddressToOrg[newFundingAddress] = orgId;

        emit OrganizationFundingAddressUpdated(orgId, msg.sender, newFundingAddress);
    }

    // Update the updateOrgSigningAddress function
    function updateOrgSigningAddress(
        bytes32 orgId,
        address newSigningAddress
    ) external {
        require(msg.sender == owner(), "Unauthorized");
        require(newSigningAddress != address(0), "Invalid address");
        require(signingAddressToOrg[newSigningAddress] == bytes32(0), "Signing address already registered");
        require(registeredOrganizations[orgId], "Organization not found");
        
        address oldSigningAddress = orgToSigningAddress[orgId];
        // Clear old mapping before setting new one
        delete signingAddressToOrg[oldSigningAddress];
        orgToSigningAddress[orgId] = newSigningAddress;
        signingAddressToOrg[newSigningAddress] = orgId;

        emit OrganizationSigningAddressUpdated(orgId, oldSigningAddress, newSigningAddress);
    }

    // Override deposit to handle organization deposits
    function orgDeposit() public payable {
        bytes32 orgId = fundingAddressToOrg[msg.sender];
        require(orgId != bytes32(0), "Not a registered funding address");
        require(msg.value > 0, "Invalid amount");
        
        organizationBalances[orgId] += msg.value;
        entryPoint.depositTo{value : msg.value}(address(this));
        
        emit OrganizationDeposit(orgId, msg.value);
    }

    // Override withdrawTo to handle organization withdrawals
    function orgWithdraw(address payable withdrawAddress, uint256 amount) public {
        bytes32 orgId = fundingAddressToOrg[msg.sender];
        require(orgId != bytes32(0), "Not a registered funding address");
        require(organizationBalances[orgId] >= amount, "Insufficient balance");
        
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
        console.log("Validating paymaster user operation");
        console.log("Required pre-fund:", requiredPreFund);

        (uint48 validUntil, uint48 validAfter, bytes32 orgId, bytes calldata signature) =
            parsePaymasterAndData(userOp.paymasterAndData);
        
        console.log("Parsed paymaster data:");
        console.log("  orgId:", uint256(orgId));
        console.log("  validUntil:", validUntil);
        console.log("  validAfter:", validAfter);
        console.log("  blocktime: ", block.timestamp);

        // Timestamp validation
        if (block.timestamp > validUntil || block.timestamp < validAfter) {
            console.log("Timestamp validation failed");
            console.log("Current timestamp:", block.timestamp);
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        require(registeredOrganizations[orgId], "Organization not registered");
        
        console.log("Organization balance:", organizationBalances[orgId]);
        require(organizationBalances[orgId] >= requiredPreFund, "Insufficient organization balance");

        bytes32 hash = ECDSA.toEthSignedMessageHash(getHash(userOp, validUntil, validAfter));
        senderNonce[userOp.getSender()]++;

        address recoveredSigner = ECDSA.recover(hash, signature);
        console.log("Recovered signer:", recoveredSigner);
        console.log("Expected signer:", orgToSigningAddress[orgId]);

        if (orgToSigningAddress[orgId] != recoveredSigner) {
            console.log("Invalid signature");
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        console.log("Validation successful");
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
        console.log("Processing post-operation");
        console.log("Mode:", uint256(mode));
        console.log("Actual gas cost:", actualGasCost);
        
        if (mode == PostOpMode.postOpReverted) {
            console.log("Operation reverted, skipping");
            return;
        }
        
        bytes32 orgId = abi.decode(context, (bytes32));
        console.log("Organization ID:", uint256(orgId));
        console.log("Previous balance:", organizationBalances[orgId]);
        
        organizationBalances[orgId] -= actualGasCost;
        console.log("New balance:", organizationBalances[orgId]);
        
        emit TransactionSponsored(orgId, msg.sender, actualGasCost);
    }
}