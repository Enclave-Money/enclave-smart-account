import { BigNumberish, Block, BytesLike, JsonRpcProvider, toBeHex, toBigInt, ZeroAddress } from "ethers";
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
    const [deployer] = await ethers.getSigners();
    console.log("Creating deposit UserOperation with account:", deployer.address);

    // Get required addresses from environment variables
    const smartAccountAddress = "0x0427634fBC64C57232B33B287343d8bF1bA36010"; // arbitrum and optimism sepolia
    // const vaultAddress = "0x87178F391869fE8D075832AD37c026dD2Cf0Fe19"; // arbitrum sepolia
    const vaultAddress = "0x783971804ADd81286C6f236c0F8D6eDeBa8AdDFd"; // optimism sepolia
    const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"; // arbitrum and optimism sepolia
    const tokenAddress = "0xE6Ee959cb60b8bdB86816f0f892587B745fd3667"; // Optimism Sepolia
    // const tokenAddress = "0xA374460eb5EA5Ea29361b4Cf4053A0A822aA5250"; // Arbitrum Sepolia
    // Connect to contracts
    const SmartAccountV1 = await ethers.getContractFactory("SmartAccountV1");
    const EnclaveVirtualLiquidityVault = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
    const smartAccount = SmartAccountV1.attach(smartAccountAddress) as any;
    const vault = EnclaveVirtualLiquidityVault.attach(vaultAddress);
    const entryPoint = await ethers.getContractAt("IEntryPoint", entryPointAddress);

    // Prepare the deposit call data
    const depositAmount = ethers.parseEther("1000");
    const depositData = vault.interface.encodeFunctionData("deposit(address,uint256)", [tokenAddress, depositAmount]);
    const smartAccountEncodedData = smartAccount.interface.encodeFunctionData("execute", [
        vaultAddress, // target
        depositAmount, // value (for ETH deposits)
        depositData // calldata
    ])

    console.log("Smart Account Encoded Data: ", smartAccountEncodedData);

    const rpcProvider = new ethers.JsonRpcProvider(`https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);

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

    console.log("7. Retrieved nonce: ", nonce);
    console.log("8. Estimated call data gas limit: ", callDataGasLimit);
    console.log("9. Calculated gas fee limits", {
        maxFeePerGas,
        maxPriorityFeePerGas,
        verificationGasLimit,
        callDataGasLimit,
    });

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

    const paymasterData = "0x";

    console.log("PAYMASTER DATA: ", paymasterData);

    const userOpHash = await entryPoint.getUserOpHash(userOp);

    console.log("Userop hash: ", userOpHash);

    const validator = "0x5144b244774f89aD766aadD5ab72e9f9F24e4655"

    // Sign the userOpHash
    const signature = await deployer.signMessage(ethers.getBytes(userOpHash));

    const encodedSig = ethers.AbiCoder.defaultAbiCoder().encode(["address", "bytes"], [validator, signature]);

    console.log("UserOp Hash:", userOpHash);
    console.log("Raw Signature:", signature);
    console.log("Encoded Signature:", encodedSig);
    console.log("Validator Address:", validator);

    // Add signature verification logging
    try {
        const recoveredAddress = ethers.verifyMessage(
            ethers.getBytes(userOpHash),
            signature
        );
        console.log("Recovered Address from Signature:", recoveredAddress);
    } catch (verifyError) {
        console.log("Signature Verification Failed:", verifyError);
    }

    const decodedSig = ethers.AbiCoder.defaultAbiCoder().decode(
        ["address", "bytes"],
        encodedSig
    );
    console.log("Decoded Signature:", {
        validatorAddress: decodedSig[0],
        signatureData: decodedSig[1]
    });

    const userOpTx = await entryPoint.handleOps(
        [{
            ...userOp,
            signature: encodedSig
        }],
        "0x88B37912a1De8C31244941cD5739fDC1354980a3" // Beneficiary
    );

    const txReceipt = await rpcProvider.getTransactionReceipt(userOpTx.hash);

    console.log("RES. Txn Receipt: ", txReceipt);

    const block = await rpcProvider.getBlock(txReceipt?.blockNumber as number);

    console.log("18. Block: ", block);

    const result = {
        txnHash: userOpTx.hash,
        blockHash: txReceipt?.blockHash,
        timestamp: block?.timestamp,
        fee: undefined
    }

    console.log("RESULT: ", result);
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
        preVerificationGas: 0, // should also cover calldata cost.
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
    // we want "item:undefined" to be used from defaults, and not override defaults, so we must explicitly
    // remove those so "merge" will succeed.
    for (const key in partial) {
        if (partial[key] == null) {
            delete partial[key];
        }
    }
    const filled = { ...defaults, ...partial };
    return filled;
}

const DefaultsForUserOp = {
    sender: ZeroAddress,
    nonce: 0,
    initCode: "0x",
    callData: "0x",
    callGasLimit: 0,
    verificationGasLimit: 1000000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
    preVerificationGas: 1000000, // should also cover calldata cost.
    maxFeePerGas: 0,
    maxPriorityFeePerGas: 1e9,
    paymasterAndData: "0x",
    signature: "0x",
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 