import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { SmartBalanceKeyValidatorV1, EnclaveRegistryV0, EnclaveVirtualLiquidityVault, IERC20 } from "../../../../typechain-types";
import { keccak256, toUtf8Bytes, parseEther, AbiCoder, ZeroHash, getBytes } from "ethers";

interface UserOperation {
    sender: string;
    nonce: number;
    initCode: string;
    callData: string;
    callGasLimit: number;
    verificationGasLimit: number;
    preVerificationGas: number;
    maxFeePerGas: number;
    maxPriorityFeePerGas: number;
    paymasterAndData: string;
    signature: string;
}

const DefaultsForUserOp: UserOperation = {
    sender: ethers.ZeroAddress,
    nonce: 0,
    initCode: "0x",
    callData: "0x",
    callGasLimit: 150000,
    verificationGasLimit: 3000000,
    preVerificationGas: 1500000,
    maxFeePerGas: 3000000000,
    maxPriorityFeePerGas: 1500000000,
    paymasterAndData: "0x",
    signature: "0x",
};

describe("SmartBalanceKeyValidatorV1", function () {
    let validator: SmartBalanceKeyValidatorV1;
    let registry: EnclaveRegistryV0;
    let vault: EnclaveVirtualLiquidityVault;
    let token: IERC20;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;
    let smartAccount: SignerWithAddress;
    let manager: SignerWithAddress;

    const SMART_BALANCE_CONVERSION_MANAGER = keccak256(toUtf8Bytes("smartBalanceConversionManager"));
    const SMART_BALANCE_VAULT = keccak256(toUtf8Bytes("smartBalanceVault"));

    beforeEach(async function () {
        [owner, user, smartAccount, manager] = await ethers.getSigners();

        // Deploy registry
        const Registry = await ethers.getContractFactory("EnclaveRegistryV0");
        registry = await Registry.deploy(manager.address);
        await registry.waitForDeployment();

        // Deploy validator
        const Validator = await ethers.getContractFactory("SmartBalanceKeyValidatorV1");
        validator = await Validator.deploy(registry.target);
        await validator.waitForDeployment();

        // Deploy mock token
        const Token = await ethers.getContractFactory("MockERC20");
        token = await Token.deploy("Test Token", "TTK");
        await token.waitForDeployment();

        // Deploy vault
        const Vault = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
        vault = await Vault.deploy(registry.target);
        await vault.waitForDeployment();

        // Set up registry
        await registry.connect(manager).updateRegistryAddress(SMART_BALANCE_CONVERSION_MANAGER, manager.address);
        await registry.connect(manager).updateRegistryAddress(SMART_BALANCE_VAULT, vault.target);
    });

    describe("validateUserOp", function () {
        it("should validate correct batch operation with approve and deposit", async function () {
            const amount = parseEther("1");
            const abiCoder = AbiCoder.defaultAbiCoder();

            // Generate approve calldata
            const approveCalldata = token.interface.encodeFunctionData("approve", [
                vault.target,
                amount
            ]);

            // Generate deposit calldata
            const depositInterface = new ethers.Interface([
                "function deposit(address _tokenAddress, uint256 _amount) public payable"
            ]);
            const depositCalldata = depositInterface.encodeFunctionData("deposit", [
                token.target,
                amount
            ]);

            // Encode executeBatch calldata
            const executeBatchInterface = new ethers.Interface([
                "function executeBatch(address[] dest, uint256[] value, bytes[] func) external"
            ]);
            const executeBatchCalldata = executeBatchInterface.encodeFunctionData("executeBatch", [
                [token.target, vault.target],
                [0, 0],
                [approveCalldata, depositCalldata]
            ]);

            const userOp: UserOperation = {
                ...DefaultsForUserOp,
                sender: smartAccount.address,
                callData: executeBatchCalldata
            };

            const userOpHash = keccak256(
                abiCoder.encode(
                    ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
                    [
                        userOp.sender,
                        userOp.nonce,
                        keccak256(userOp.initCode),
                        keccak256(userOp.callData),
                        userOp.callGasLimit,
                        userOp.verificationGasLimit,
                        userOp.preVerificationGas,
                        userOp.maxFeePerGas,
                        userOp.maxPriorityFeePerGas,
                        keccak256(userOp.paymasterAndData)
                    ]
                )
            );

            const signature = await manager.signMessage(getBytes(userOpHash));
            userOp.signature = signature;

            const result = await validator.validateUserOp(userOp, userOpHash);
            expect(result).to.equal(0);
        });

        it("should reject batch with more than 3 operations", async function () {
            const abiCoder = AbiCoder.defaultAbiCoder();
            const executeBatchInterface = new ethers.Interface([
                "function executeBatch(address[] dest, uint256[] value, bytes[] func) external"
            ]);
            const executeBatchCalldata = executeBatchInterface.encodeFunctionData("executeBatch", [
                [token.target, vault.target, token.target, vault.target], // 4 operations
                [0, 0, 0, 0],
                ["0x", "0x", "0x", "0x"]
            ]);

            const userOp: UserOperation = {
                ...DefaultsForUserOp,
                sender: smartAccount.address,
                callData: executeBatchCalldata
            };

            const result = await validator.validateUserOp(userOp, ZeroHash);
            expect(result).to.equal(1);
        });

        it("should reject batch with invalid function selector", async function () {
            const abiCoder = AbiCoder.defaultAbiCoder();
            const executeBatchInterface = new ethers.Interface([
                "function executeBatch(address[] dest, uint256[] value, bytes[] func) external"
            ]);
            const executeBatchCalldata = executeBatchInterface.encodeFunctionData("executeBatch", [
                [token.target, vault.target],
                [0, 0],
                ["0x12345678", "0x87654321"]
            ]);

            const userOp: UserOperation = {
                ...DefaultsForUserOp,
                sender: smartAccount.address,
                callData: executeBatchCalldata
            };

            const result = await validator.validateUserOp(userOp, ZeroHash);
            expect(result).to.equal(1);
        });

        it("should reject batch with deposit to wrong vault address", async function () {
            const amount = parseEther("1");
            const abiCoder = AbiCoder.defaultAbiCoder();

            // Generate approve calldata
            const approveCalldata = token.interface.encodeFunctionData("approve", [
                vault.target,
                amount
            ]);

            // Generate deposit calldata
            const depositInterface = new ethers.Interface([
                "function deposit(address _tokenAddress, uint256 _amount) public payable"
            ]);
            const depositCalldata = depositInterface.encodeFunctionData("deposit", [
                token.target,
                amount
            ]);

            // Encode executeBatch calldata
            const executeBatchInterface = new ethers.Interface([
                "function executeBatch(address[] dest, uint256[] value, bytes[] func) external"
            ]);
            const executeBatchCalldata = executeBatchInterface.encodeFunctionData("executeBatch", [
                [token.target, user.address], // Wrong vault address
                [0, 0],
                [approveCalldata, depositCalldata]
            ]);

            const userOp: UserOperation = {
                ...DefaultsForUserOp,
                sender: smartAccount.address,
                callData: executeBatchCalldata
            };

            const result = await validator.validateUserOp(userOp, ZeroHash);
            expect(result).to.equal(1);
        });

        it("should reject batch with invalid signature", async function () {
            const amount = parseEther("1");
            const abiCoder = AbiCoder.defaultAbiCoder();

            // Generate approve calldata
            const approveCalldata = token.interface.encodeFunctionData("approve", [
                vault.target,
                amount
            ]);

            // Generate deposit calldata
            const depositInterface = new ethers.Interface([
                "function deposit(address _tokenAddress, uint256 _amount) public payable"
            ]);
            const depositCalldata = depositInterface.encodeFunctionData("deposit", [
                token.target,
                amount
            ]);

            // Encode executeBatch calldata
            const executeBatchInterface = new ethers.Interface([
                "function executeBatch(address[] dest, uint256[] value, bytes[] func) external"
            ]);
            const executeBatchCalldata = executeBatchInterface.encodeFunctionData("executeBatch", [
                [token.target, vault.target],
                [0, 0],
                [approveCalldata, depositCalldata]
            ]);

            const userOp: UserOperation = {
                ...DefaultsForUserOp,
                sender: smartAccount.address,
                callData: executeBatchCalldata,
                signature: "0x1234"
            };

            const result = await validator.validateUserOp(userOp, ZeroHash);
            expect(result).to.equal(1);
        });

        it("should reject if validator is disabled", async function () {
            await validator.connect(smartAccount).onUninstall("0x");

            const userOp: UserOperation = {
                ...DefaultsForUserOp,
                sender: smartAccount.address
            };

            await expect(validator.validateUserOp(userOp, ZeroHash))
                .to.be.revertedWith("Module is disabled");
        });
    });

    describe("isValidSignatureWithSender", function () {
        it("should validate correct signature", async function () {
            const hash = keccak256("0x1234");
            const signature = await manager.signMessage(getBytes(hash));

            const result = await validator.isValidSignatureWithSender(
                smartAccount.address,
                hash,
                signature
            );
            expect(result).to.equal("0x1626ba7e");
        });

        it("should reject invalid signature", async function () {
            const hash = keccak256("0x1234");
            const signature = await user.signMessage(getBytes(hash));

            const result = await validator.isValidSignatureWithSender(
                smartAccount.address,
                hash,
                signature
            );
            expect(result).to.equal("0xffffffff");
        });

        it("should reject if validator is disabled", async function () {
            await validator.connect(smartAccount).onUninstall("0x");

            const hash = keccak256("0x1234");
            const signature = await manager.signMessage(getBytes(hash));

            await expect(validator.isValidSignatureWithSender(
                smartAccount.address,
                hash,
                signature
            )).to.be.revertedWith("Module is disabled");
        });
    });
}); 