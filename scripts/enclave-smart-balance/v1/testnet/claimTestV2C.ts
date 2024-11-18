import { getBytes, keccak256, toUtf8Bytes } from "ethers";
import { ethers } from "hardhat";

function hexConcat(items: string[]) {
    let result = "0x";
    items.forEach((item) => {
        result += item.substring(2);
    });
    return result;
}

function toEIP191SignableMessage(hash: string): string {
  const messagePrefix = "\x19Ethereum Signed Message:\n32";
  const message = messagePrefix + hash;
  const messageBytes = toUtf8Bytes(message);
  const prefixedHash = keccak256(messageBytes);
  return prefixedHash;
}

async function main() {
  const userOp = {
    sender: "0xd11b1d18392bEE5a5A95F7e4Abb4bEDfa1Eb6959",
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
    1000000, 
    1000000
];
  const addresses = [
    "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", 
    "0x5fd84259d66Cd46123540766Be93DFE6D43130D7"
]
  const chainIds = [
    "421614", 
    "11155420",
    // "11155111"
]
  const userAddress = userOp.sender;
  const VerifyingSigner = "0x399e8917Cd7Ce367b06bFfd0863E465B0Fd950dB";
  const routerRNSAddress = "router1uvas7c2nywsegee5s0sq6zyyn7txyr8q79dn0pq3m3k7vz6mq5vshv4jah";

//   const paymasterAddress = "0x16c980e71E3f38275B7272603C7dCb0f353afD49"

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

  const paymasterContractFactory = await ethers.getContractFactory("EnclaveSolverPaymasterV2C");
  // OP
  // const paymasterContract = paymasterContractFactory.attach("0x06E32e97556745C45f0636E23d0AE1FDdce72503");

    const paymasterContract = await paymasterContractFactory.deploy(VerifyingSigner, VerifyingSigner, VerifyingSigner, "yo", "1");
    await paymasterContract.waitForDeployment();
    const paymasterAddress = paymasterContract.target;

  const validUntil = Math.floor((Date.now() + 3600000) / 1000);
  const validAfter = Math.floor(Date.now() / 1000);

  console.log(validAfter, ' - ', validUntil);

  //@ts-ignore
  const hash = await paymasterContract.getHash(
    userOp,
    validUntil,
    validAfter,
    addresses[1],
    amounts[0] + amounts[1]
  );

  const hash2 = ethers.hashMessage(getBytes(hash));
  console.log("Hash2: ", hash2);

  const ethSignedHash = toEIP191SignableMessage(hash);

  console.log("Paymaster hash: ", hash, " ", ethSignedHash);

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
    [addresses[1],amounts[0] + amounts[1], amounts[0] + amounts[1]]
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
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
