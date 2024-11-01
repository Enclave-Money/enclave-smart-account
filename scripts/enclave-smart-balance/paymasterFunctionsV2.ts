import { ethers } from "hardhat";

async function main() {
  const userOp = {
    sender: "0xd11b1d18392bEE5a5A95F7e4Abb4bEDfa1Eb6959",
    nonce: "2",
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

  const paymasterContractFactory = await ethers.getContractFactory("EnclaveSolverPaymasterV2");
  const paymasterContract = await paymasterContractFactory.deploy("0xF522AA3eC4dA6237a9570021AB6187Ca111aa8b3", "0x399e8917Cd7Ce367b06bFfd0863E465B0Fd950dB");
  // const paymasterContract = paymasterContractFactory.attach("0x6e91FA1AaC162d93Cb3F22fd7517337b04792D32");
  
  console.log("Paymaster contract deployed at:", paymasterContract.target);

  const res = await paymasterContract.deposit({value: ethers.parseEther("0.01")});
  console.log("Deposit result:", res);

  // const paymasterAndData = "0x3dae8eb23cc176878c3e09cf6f9a7bf27ee7029a00000000000000000000000000000000000000000000000000000000671011c300000000000000000000000000000000000000000000000000000000671003b30000000000000000000000005fd84259d66cd46123540766be93dfe6d43130d700000000000000000000000000000000000000000000000000000000000fb77029fb4d78d375a02e1e4d07e42d82364d7a5bd8383fa6b3721cf760b8040ea3805d7d12b6db086e3f957d1b635daa7a25b9084bd65bac41e5f88546f2599e63de1c"

  // // @ts-ignore
  // const parsedPaymasterAndData = await paymasterContract.withdrawTo("0x399e8917Cd7Ce367b06bFfd0863E465B0Fd950dB", ethers.parseEther("0.02"));
  // console.log("Parsed paymaster and data:", parsedPaymasterAndData);

  // const tokenAddress = "0xf09156042741F67F8099D17eB22638F01F97974b";
  // const amount = 15000;

  // // Valid from and valid until timestamp
  // const VALID_UNTIL = Math.floor((Date.now() + 3600000) / 1000);
  // const VALID_AFTER = Math.floor(Date.now() / 1000);

  // try {
  //   // @ts-ignore
  //   const hash = await paymasterContract.getHash(userOp, VALID_UNTIL, VALID_AFTER, tokenAddress, amount);
  //   console.log("Generated hash:", hash);
  // } catch (error) {
  //   console.error("Error calling getHash:", error);
  // }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

