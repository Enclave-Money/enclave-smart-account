import {
	BigNumberish,
	Block,
	BytesLike,
	JsonRpcProvider,
	toBigInt,
	ZeroAddress,
} from "ethers";
import { ethers } from "hardhat";
import * as testnetContracts from "../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, OP_SEPOLIA_SLUG } from "../demo/socket/constants";

async function main() {
	const [deployer] = await ethers.getSigners();
	console.log(
		"Creating deposit UserOperation with account:",
		deployer.address
	);

	// const currentSlug = ARB_SEPOLIA_SLUG;
	const currentSlug = OP_SEPOLIA_SLUG;

	// const rpcProvider = new ethers.JsonRpcProvider(
	// 	`https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
	// );

	const rpcProvider = new ethers.JsonRpcProvider(
		`https://opt-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
	);

	// Connect to contracts
	const SmartAccountV1 = await ethers.getContractFactory("SmartAccountV1");
	const EnclaveVirtualLiquidityVault = await ethers.getContractFactory(
		"EnclaveVirtualLiquidityVault"
	);

	// Get contract instances
	const smartAccount = SmartAccountV1.attach(
		testnetContracts[currentSlug].smartAccountV1
	) as any;
	const vault = EnclaveVirtualLiquidityVault.attach(
		testnetContracts[currentSlug].vault
	) as any;
	const USDC = (await ethers.getContractAt(
		"IERC20",
		testnetContracts[currentSlug].USDC
	)) as any;
	const entryPoint = await ethers.getContractAt(
		"IEntryPoint",
		testnetContracts[currentSlug].entrypoint
	);

	// Prepare the deposit call data
	const depositAmount = BigInt(10 * 10**6); // 10 USDC (6 decimals)

	// Generate approval calldata
	console.log("Encoding approval...");
	const approveData = USDC.interface.encodeFunctionData("approve", [
		testnetContracts[currentSlug].vault,
		depositAmount
	]);

	// Generate deposit calldata
	console.log("Preparing deposit...");
	const depositData = vault.interface.encodeFunctionData(
		"deposit(address,uint256)",
		[testnetContracts[currentSlug].USDC, depositAmount]
	);

	// Use executeBatch to combine approval and deposit into one UserOp
	const batchEncodedData = smartAccount.interface.encodeFunctionData(
		"executeBatch",
		[
			[
				testnetContracts[currentSlug].USDC,   // First target: USDC contract
				testnetContracts[currentSlug].vault   // Second target: Vault contract
			],
			[
				0,                              // First value: 0 ETH
				0                               // Second value: 0 ETH
			],
			[
				approveData,                    // First calldata: approve USDC
				depositData                     // Second calldata: deposit to vault
			]
		]
	);

	console.log("Batch Encoded Data:", batchEncodedData);

	const callDataGasLimitPromise = rpcProvider.estimateGas({
		from: testnetContracts[currentSlug].entrypoint,
		to: testnetContracts[currentSlug].smartAccountV1,
		data: batchEncodedData,
	});

	const gasFeePromise = getGasFee(rpcProvider);

	const [
		callDataGasLimit,
		{ maxFeePerGas, maxPriorityFeePerGas, verificationGasLimit },
	] = await Promise.all([callDataGasLimitPromise, gasFeePromise]);

	const nonce = await smartAccount.getNonce();

	console.log("Retrieved nonce:", nonce);
	console.log("Estimated call data gas limit:", callDataGasLimit);
	console.log("Calculated gas fee limits", {
		maxFeePerGas,
		maxPriorityFeePerGas,
		verificationGasLimit,
		callDataGasLimit,
	});

	const validator = testnetContracts[currentSlug].smartAccountECDSAValidator;

	const op = getInitialUserOp(
		testnetContracts[currentSlug].smartAccountV1,
		batchEncodedData,
		BigInt(nonce).toString(),
		(callDataGasLimit * BigInt(2)).toString(),
		verificationGasLimit,
		maxFeePerGas,
		maxPriorityFeePerGas
	);

	const userOp = fillUserOpDefaults(op);

	userOp.preVerificationGas = 1000000;
	userOp.maxFeePerGas = maxFeePerGas.toString();

	const userOpHash = await entryPoint.getUserOpHash(userOp);

	console.log("UserOp hash:", userOpHash);

	// Sign the userOpHash
	const signature = await deployer.signMessage(ethers.getBytes(userOpHash));

	const encodedSig = ethers.AbiCoder.defaultAbiCoder().encode(
		["address", "bytes"],
		[validator, signature]
	);

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
		signatureData: decodedSig[1],
	});

	const userOpTx = await entryPoint.handleOps(
		[
			{
				...userOp,
				signature: encodedSig,
			},
		],
		"0x88B37912a1De8C31244941cD5739fDC1354980a3" // Beneficiary
	);

	const txReceipt = await rpcProvider.getTransactionReceipt(userOpTx.hash);

	console.log("Txn Hash:", userOpTx.hash);
	console.log("Approved and deposited", ethers.formatUnits(depositAmount, 6), "USDC to vault");
}

const getGasFee = async (provider: JsonRpcProvider) => {
	const verificationGasLimit = 300000;
	const block: Block = (await provider.getBlock("latest")) as Block;
	const feeData = await provider.getFeeData();
	const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0;
	const maxFeePerGas =
		feeData.maxFeePerGas ??
		(block.baseFeePerGas
			? toBigInt("2") * block.baseFeePerGas +
			  toBigInt(maxPriorityFeePerGas)
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
