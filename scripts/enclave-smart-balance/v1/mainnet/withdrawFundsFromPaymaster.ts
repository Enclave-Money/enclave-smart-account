import { ethers } from "hardhat";
import { USDC_ADDRESSES } from "./0-constants";
import { hexConcat } from "../../../constants";
import { getBytes } from "ethers";
import { getContractFactory } from "@nomicfoundation/hardhat-ethers/types";

async function main() {

    const CHAIN_ID = 42161;
  // USE DEPLOYMENT KEY FOR SAME ADDR DEPLOYMENT
//   const paymasterAddress = "0x2770A44cd727982558d625f56b2b7dE3842188ac";
    const paymasterAddress = "0xB3a2729638C3667C9559DD75a3504C57D1025999";

  const paymasterContractFactory = await ethers.getContractFactory("EnclaveSolverPaymasterV2C");

  const paymasterContract = paymasterContractFactory.attach(paymasterAddress);

  const userOp = {
    sender: "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00",
    nonce: "27",
    initCode: "0x",
    callData: "0x47e1da2a000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000f09156042741f67f8099d17eb22638f01f97974b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000044a9059cbb00000000000000000000000049140bb5ad7c8978af483be9ca9eb40e57da0fdf0000000000000000000000000000000000000000000000000000000000003a9800000000000000000000000000000000000000000000000000000000",
    callGasLimit: "198891",
    verificationGasLimit: "1000000",
    preVerificationGas: 300000,
    maxFeePerGas: "506",
    maxPriorityFeePerGas: 0,
    paymasterAndData: "0x",
    signature: "0x"
  };

  const amounts = [
    0,
  ];
  const addresses = [
    USDC_ADDRESSES[CHAIN_ID], 
  ];
  const chainIds = [
    CHAIN_ID.toString()
  ];

  const userAddress = userOp.sender;
  const VerifyingSigner = "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00";
  const routerRNSAddress = "router12xgvfsvqsp6gw8pd7ven73t07wnz78vvqdxt898tmzmsuhxk0amqkmxg5j";

  const reclaimPlan = ethers.AbiCoder.defaultAbiCoder().encode(["string[]", "address[]", "uint256[]", "address", "address"], [
    chainIds,
    addresses,
    amounts,
    VerifyingSigner,
    userAddress
  ]);


  console.log("Reclaim Plan: ", reclaimPlan);

  const requestPacket = ethers.AbiCoder.defaultAbiCoder().encode(["string", "bytes"], [routerRNSAddress, reclaimPlan]);
  console.log("Request Packet: ", requestPacket);

  const validUntil = Math.floor((Date.now() + 3600000) / 1000);
  const validAfter = Math.floor(Date.now() / 1000);

  console.log(validAfter, ' - ', validUntil);

  const usdcFac = await ethers.getContractFactory("ERC20");
  const usdContract = usdcFac.attach(USDC_ADDRESSES[CHAIN_ID]);

  //@ts-ignore
  const balance = await usdContract.balanceOf(paymasterAddress);

  console.log("USDC Balance of paymaster: ", balance);

  //@ts-ignore
  const hash = await paymasterContract.getHash(
    userOp,
    validUntil,
    validAfter,
    addresses[0],
    balance
  );

  const hash2 = ethers.hashMessage(getBytes(hash));
  console.log("Hash2: ", hash2);

  const [signer] = await ethers.getSigners();

  console.log("Signer Addr: ", signer.address);
  
  // Sign the hash
  const signature = await signer.signMessage(getBytes(hash));
  console.log("Signature:", signature, signature.length);

  console.log("Recovered addr: ", ethers.verifyMessage(getBytes(hash), signature));

  // console.log("Recover2: ", ethers.recoverAddress())

  const encodedTimestamps = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint48", "uint48"],
    [validUntil, validAfter]
  );

  const encodedAmount = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "uint256"],
    [addresses[0],balance, balance]
  );

  const paymasterAndData = hexConcat([
    paymasterAddress as string,
    encodedTimestamps,
    encodedAmount,
    signature,
    reclaimPlan
  ]);

  console.log("paymasterAndData: ", paymasterAndData);

  //@ts-ignore
  const parsedPaymasterAndData = await paymasterContract.parsePaymasterAndData(paymasterAndData);
  console.log("Parsed: ", parsedPaymasterAndData);

  const preParsedReclaim = parsedPaymasterAndData[6];

  const parsedReclaimPlan = ethers.AbiCoder.defaultAbiCoder().decode(
    ["string[]", "address[]", "uint256[]", "address", "address"],
    preParsedReclaim
  );

  console.log("Parsed reclaim: ", parsedReclaimPlan);

  // @ts-ignore
  const requestMetadata = await paymasterContract.getRequestMetadata(
    5000000,
    50000000,
    5000000,
    0,
    0,
    0,
    false,
    "0x"
    );

    console.log("Request metadata: ", requestMetadata);

  //@ts-ignore
  let tx = await paymasterContract.claim({...userOp, paymasterAndData }, hash2, requestMetadata);
    await tx.wait();

    //@ts-ignore
    console.log("ETH balance: ", await paymasterContract.getDeposit());

    //@ts-ignore
    tx = await paymasterContract.withdrawTo(VerifyingSigner, await paymasterContract.getDeposit());
    await tx.wait();
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

