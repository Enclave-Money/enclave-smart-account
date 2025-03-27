import { BigNumberish, Block, BytesLike, JsonRpcProvider, parseEther, toBeHex, toBigInt, ZeroAddress } from "ethers";
import { ethers } from "hardhat";
import * as testnetContracts from "../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, OP_SEPOLIA_SLUG, MONAD_TEST_SLUG } from "../demo/socket/constants";


async function main() {
    const wallet = new ethers.Wallet(process.env.TEST_KEY as string, ethers.provider);
    const [deployer] = await ethers.getSigners();

    console.log("Creating claim UserOperation with account:", deployer.address);

    // Get required addresses
    const smartAccountAddress = testnetContracts[MONAD_TEST_SLUG].smartAccountV1;
    const vaultAddresses = {
        monad: testnetContracts[MONAD_TEST_SLUG].vault,
        arbitrum: testnetContracts[ARB_SEPOLIA_SLUG].vault,
        optimism: testnetContracts[OP_SEPOLIA_SLUG].vault
    };
    const entryPointAddress = testnetContracts[MONAD_TEST_SLUG].entrypoint;
    const USDCAddressArbitrum = testnetContracts[ARB_SEPOLIA_SLUG].USDC;
    const USDCAddressOptimism = testnetContracts[OP_SEPOLIA_SLUG].USDC;
    const USDCAddressMonad = testnetContracts[MONAD_TEST_SLUG].USDC;
    const solverAddress = ZeroAddress;
    const settlementModuleAddress = testnetContracts[MONAD_TEST_SLUG].module;
    const receiverAddress = "0xaB47abB694fD7eFAa85C94B11c5B31547D593189"; // The address that will receive the USDC

    // Connect to contracts
    const SmartAccountV1 = await ethers.getContractFactory("SmartAccountV1");
    const EnclaveVirtualLiquidityVault = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
    const smartAccount = SmartAccountV1.attach(smartAccountAddress) as any;
    const monadVault = EnclaveVirtualLiquidityVault.attach(vaultAddresses.monad);
    const entryPoint = await ethers.getContractAt("IEntryPoint", entryPointAddress);

    // Claim amounts from each chain
    const arbitrumAmount = BigInt(10 * 10 ** 6); // 10 USDC
    const optimismAmount = BigInt(5 * 10 ** 6); // 5 USDC
    const totalAmount = arbitrumAmount + optimismAmount; // Claiming 15 USDC

    // Create USDC ERC20 interface for transfer
    const USDC = (await ethers.getContractAt(
		"IERC20",
		USDCAddressMonad
	)) as any

    // Time validity parameters
    const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const validAfter = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

    // Create reclaim plan for deducting from Arbitrum and Optimism
    const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [
            settlementModuleAddress,
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint32[]", "address[]", "uint256[]", "address", "address"],
                [
                    [421614, 11155420], // Arbitrum and Optimism Sepolia chain IDs
                    [USDCAddressArbitrum, USDCAddressOptimism], // Same token on both chains
                    [arbitrumAmount, optimismAmount], // Amounts to deduct from each chain
                    solverAddress,
                    smartAccountAddress
                ]
            )
        ]
    );

    const creditAmount = totalAmount - BigInt(1 * 10 ** 6); // 1 USDC less than total amount 
    const debitAmount = totalAmount;

    // Construct claim data
    const claimData = await constructClaimData(
        validUntil,
        validAfter,
        testnetContracts[MONAD_TEST_SLUG].USDC,
        creditAmount,
        debitAmount,
        wallet,
        monadVault,
        smartAccountAddress,
        reclaimPlan
    );

    console.log("Claim data prepared:", claimData);

    // Create calldata for the claim function
    const vaultClaimData = monadVault.interface.encodeFunctionData("claim", [claimData]);

    // Create transfer calldata - transfer all claimed USDC to the receiver
    const transferCalldata = USDC.interface.encodeFunctionData("transfer", [
        receiverAddress,
        creditAmount
    ]);
    
    // Construct smart account executeBatch call with multiple transactions
    const smartAccountEncodedData = smartAccount.interface.encodeFunctionData("executeBatch", [
        [
            vaultAddresses.monad,                         // First target: vault
            USDCAddressMonad                              // Second target: USDC token contract
        ],
        [
            0,                                            // First value: 0 ETH
            0                                             // Second value: 0 ETH
        ],
        [
            vaultClaimData,                               // First calldata: claim USDC
            transferCalldata                              // Second calldata: transfer USDC directly
        ]
    ]);

    // const smartAccountEncodedData = smartAccount.interface.encodeFunctionData("execute", [
    //     vaultAddresses.monad,
    //     0,
    //     vaultClaimData
    // ]);

    console.log("Smart Account Encoded Data:", smartAccountEncodedData);

    // Set up RPC provider
    const rpcProvider = new ethers.JsonRpcProvider(`https://monad-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);

    // Get gas estimates
    const callDataGasLimitPromise = rpcProvider.estimateGas({
        from: entryPointAddress,
        to: smartAccountAddress,
        data: smartAccountEncodedData,
    });

    const gasFeePromise = getGasFee(rpcProvider);

    const [callDataGasLimit, { maxFeePerGas, maxPriorityFeePerGas, verificationGasLimit }] = await Promise.all([
        callDataGasLimitPromise,
        gasFeePromise
    ]);

    const nonce = await smartAccount.getNonce();

    console.log("Retrieved nonce:", nonce);
    console.log("Estimated call data gas limit:", callDataGasLimit);
    console.log("Calculated gas fee limits", {
        maxFeePerGas,
        maxPriorityFeePerGas,
        verificationGasLimit,
        callDataGasLimit,
    });

    // Create UserOperation
    const op = getInitialUserOp(
        smartAccountAddress,
        smartAccountEncodedData,
        BigInt(nonce).toString(),
        (callDataGasLimit * BigInt(2)).toString(),
        verificationGasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas
    );

    const userOp = fillUserOpDefaults(op);

    userOp.preVerificationGas = 1000000;
    userOp.maxFeePerGas = maxFeePerGas.toString();

    // Get userOp hash
    const userOpHash = await entryPoint.getUserOpHash(userOp);
    console.log("UserOp hash:", userOpHash);

    // Use validator address from your smart account setup
    const validator = "0x5144b244774f89aD766aadD5ab72e9f9F24e4655";

    // Sign the userOpHash
    const signature = await deployer.signMessage(ethers.getBytes(userOpHash));

    // Encode signature
    const encodedSig = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [validator, signature]
    );

    console.log("Raw Signature:", signature);
    console.log("Encoded Signature:", encodedSig);

    // Verify signature
    try {
        const recoveredAddress = ethers.verifyMessage(
            ethers.getBytes(userOpHash),
            signature
        );
        console.log("Recovered Address from Signature:", recoveredAddress);
    } catch (verifyError) {
        console.log("Signature Verification Failed:", verifyError);
    }

    // Submit UserOperation
    const userOpTx = await entryPoint.handleOps(
        [{
            ...userOp,
            signature: encodedSig
        }],
        "0x88B37912a1De8C31244941cD5739fDC1354980a3" // Beneficiary
    );

    const txReceipt = await rpcProvider.getTransactionReceipt(userOpTx.hash);

    console.log("Claim Txn Hash:", txReceipt?.hash);

    console.log("Claimed", totalAmount, "USDC on Monad");
    console.log("Deducted", arbitrumAmount, "USDC from Arbitrum");
    console.log("Deducted", optimismAmount, "USDC from Optimism");
    console.log("Transferred", ethers.formatUnits(creditAmount, 6), "USDC to receiver:", receiverAddress);
}

async function constructClaimData(
    validUntil: number,
    validAfter: number,
    tokenAddress: string,
    creditAmount: bigint,
    debitAmount: bigint,
    signer: any,
    vault: any,
    userAddress: string,
    reclaimPlan: string
) {
    const encodedTimestamps = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint48", "uint48"],
        [validUntil, validAfter]
    );

    const encodedAmounts = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint256"],
        [tokenAddress, creditAmount, debitAmount]
    );

    const hash = await vault.getClaimHash(
        userAddress,
        validUntil,
        validAfter,
        tokenAddress,
        creditAmount,
        reclaimPlan
    );

    const signature = await signer.signMessage(ethers.getBytes(hash));

    return ethers.concat([
        vault.target as string,
        encodedTimestamps,
        encodedAmounts,
        signature,
        reclaimPlan
    ]);
}

const getGasFee = async (provider: JsonRpcProvider) => {
    const verificationGasLimit = 300000;
    const block: Block = (await provider.getBlock("latest")) as Block;
    const feeData = await provider.getFeeData();
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0;
    const maxFeePerGas = feeData.maxFeePerGas ?? (block.baseFeePerGas
        ? toBigInt("2") * block.baseFeePerGas + toBigInt(maxPriorityFeePerGas)
        : maxPriorityFeePerGas);

    return { maxFeePerGas, maxPriorityFeePerGas, verificationGasLimit };
};

function getInitialUserOp(
    sender: string,
    callData: string,
    nonce: BigNumberish,
    callGasLimit: BigNumberish,
    verificationGasLimit: number,
    maxFeePerGas: BigNumberish,
    maxPriorityFeePerGas: BigNumberish
): UserOperationStruct {
    return {
        sender,
        nonce,
        initCode: null,
        callData,
        callGasLimit,
        verificationGasLimit,
        preVerificationGas: 0,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndData: "0x",
        signature: "0x",
    };
}

type PromiseOrValue<T> = T | Promise<T>;

type UserOperationStruct = {
    sender: PromiseOrValue<string>;
    nonce: PromiseOrValue<BigNumberish> | null;
    initCode: PromiseOrValue<BytesLike> | null;
    callData: PromiseOrValue<BytesLike>;
    callGasLimit: PromiseOrValue<BigNumberish> | null;
    verificationGasLimit: PromiseOrValue<BigNumberish>;
    preVerificationGas: PromiseOrValue<BigNumberish>;
    maxFeePerGas: PromiseOrValue<BigNumberish> | null;
    maxPriorityFeePerGas: PromiseOrValue<BigNumberish> | null;
    paymasterAndData: PromiseOrValue<BytesLike>;
    signature: PromiseOrValue<BytesLike>;
};

function fillUserOpDefaults(
    op: UserOperationStruct,
    defaults = DefaultsForUserOp
) {
    const partial: any = { ...op };
    for (const key in partial) {
        if (partial[key] == null) {
            delete partial[key];
        }
    }
    return { ...defaults, ...partial };
}

const DefaultsForUserOp = {
    sender: ZeroAddress,
    nonce: 0,
    initCode: "0x",
    callData: "0x",
    callGasLimit: 0,
    verificationGasLimit: 1000000,
    preVerificationGas: 1000000,
    maxFeePerGas: 0,
    maxPriorityFeePerGas: 1e9,
    paymasterAndData: "0x",
    signature: "0x",
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
