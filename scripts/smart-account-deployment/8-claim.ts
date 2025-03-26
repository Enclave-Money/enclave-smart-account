import { BigNumberish, Block, BytesLike, JsonRpcProvider, parseEther, toBeHex, toBigInt, ZeroAddress } from "ethers";
import { ethers } from "hardhat";

// Define UserOperation type
interface UserOperation {
    sender: string;
    nonce: bigint | string;
    initCode: string;
    callData: string;
    callGasLimit: bigint | string;
    verificationGasLimit: bigint | string;
    preVerificationGas: bigint | string;
    maxFeePerGas: bigint | string;
    maxPriorityFeePerGas: bigint;
    paymasterAndData: string;
    signature: string;
}

// Helper function to convert UserOperation to JSON-serializable format
function serializeUserOp(userOp: UserOperation) {
    return {
        sender: userOp.sender,
        nonce: userOp.nonce.toString(),
        initCode: userOp.initCode,
        callData: userOp.callData,
        callGasLimit: userOp.callGasLimit.toString(),
        verificationGasLimit: userOp.verificationGasLimit.toString(),
        preVerificationGas: userOp.preVerificationGas.toString(),
        maxFeePerGas: userOp.maxFeePerGas,
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
        paymasterAndData: userOp.paymasterAndData,
        signature: userOp.signature
    };
}

async function main() {
    const wallet = new ethers.Wallet(process.env.TEST_KEY as string, ethers.provider);
    const [deployer] = await ethers.getSigners();

    console.log("Creating claim UserOperation with account:", deployer.address);

    // Get required addresses
    const smartAccountAddress = "0x158304a8fdb1b594c21e14b2cc9010664bc69c79"; // Monad
    const vaultAddresses = {
        monad: "0x1c819116A4a32d9a8b74860B277554E1A6fcd7FB",
        arbitrum: "0x87178F391869fE8D075832AD37c026dD2Cf0Fe19",
        optimism: "0x783971804ADd81286C6f236c0F8D6eDeBa8AdDFd"
    };
    const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    const tokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; // ETH
    const solverAddress = ZeroAddress;
    const settlementModuleAddress = "0x52DCf8861883d58f08f974aF51A007d68756E378"; // Monad

    // Connect to contracts
    const SmartAccountV1 = await ethers.getContractFactory("SmartAccountV1");
    const EnclaveVirtualLiquidityVault = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
    const smartAccount = SmartAccountV1.attach(smartAccountAddress) as any;
    const monadVault = EnclaveVirtualLiquidityVault.attach(vaultAddresses.monad);
    const entryPoint = await ethers.getContractAt("IEntryPoint", entryPointAddress);

    // Claim amounts from each chain
    const arbitrumAmount = ethers.parseEther("0.001");
    const optimismAmount = ethers.parseEther("0.002");
    const totalAmount = arbitrumAmount + optimismAmount;

    // Time validity parameters
    const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const validAfter = Math.floor(Date.now() / 1000) - 60; // 1 minute ago

    // Create reclaim plan for deducting from Arbitrum and Optimism
    const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [
            settlementModuleAddress,
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint32[]", "address[]", "uint256[]", "address", "address"],
                [
                    [421614, 11155420], // Arbitrum and Optimism Sepolia chain IDs
                    [tokenAddress, tokenAddress], // Same token on both chains
                    [arbitrumAmount, optimismAmount], // Amounts to deduct from each chain
                    solverAddress,
                    smartAccountAddress
                ]
            )
        ]
    );

    const creditAmount = totalAmount;
    const debitAmount = totalAmount + ethers.parseEther("0.0001");

    // Construct claim data
    const claimData = await constructClaimData(
        validUntil,
        validAfter,
        tokenAddress,
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
    
    // Construct smart account executeBatch call with multiple transactions
    // const smartAccountEncodedData = smartAccount.interface.encodeFunctionData("executeBatch", [
    //     [
    //         vaultAddresses.monad,                         // First target: vault
    //         "0xaB47abB694fD7eFAa85C94B11c5B31547D593189"  // Second target: specified address
    //     ],
    //     [
    //         0,                                            // First value: 0 ETH
    //         parseEther("0.0005")                                             // Second value: 0 ETH
    //     ],
    //     [
    //         vaultClaimData,                               // First calldata: claim
    //         "0x"                                          // Second calldata: empty (simple interaction)
    //     ]
    // ]);

    const smartAccountEncodedData = smartAccount.interface.encodeFunctionData("execute", [
        vaultAddresses.monad,
        0,
        vaultClaimData
    ]);

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
    console.log("Transaction Receipt:", txReceipt);

    const block = await rpcProvider.getBlock(txReceipt?.blockNumber as number);
    console.log("Block:", block);

    const result = {
        txnHash: userOpTx.hash,
        blockHash: txReceipt?.blockHash,
        timestamp: block?.timestamp,
    }

    console.log("RESULT:", result);
    console.log("Claimed", ethers.formatEther(totalAmount), "ETH on Monad");
    console.log("Deducted", ethers.formatEther(arbitrumAmount), "ETH from Arbitrum");
    console.log("Deducted", ethers.formatEther(optimismAmount), "ETH from Optimism");
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
