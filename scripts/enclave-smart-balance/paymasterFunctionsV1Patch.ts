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

  const paymasterContractFactory = await ethers.getContractFactory("EnclaveSolverPaymasterV1Patch");
  const paymasterContract = await paymasterContractFactory.deploy("0xF522AA3eC4dA6237a9570021AB6187Ca111aa8b3", "0x399e8917Cd7Ce367b06bFfd0863E465B0Fd950dB");
  // const paymasterContract = paymasterContractFactory.attach("0xada592b297ab5a01B0D0563eeBb692dE461Ad92a");
  
  console.log("Paymaster contract deployed at:", paymasterContract.target);

  const res = await paymasterContract.deposit({value: ethers.parseEther("0.01")});
  console.log("Deposit result:", res);

  const tokenAddress = "0xf09156042741F67F8099D17eB22638F01F97974b";
  const amount = 15000;

  // Valid from and valid until timestamp
  const VALID_UNTIL = Math.floor((Date.now() + 3600000) / 1000);
  const VALID_AFTER = Math.floor(Date.now() / 1000);

  // const paymasterAndData = "0xada592b297ab5a01b0d0563eebb692de461ad92a0000000000000000000000000000000000000000000000000000670f6ec900000000000000000000000000000000000000000000000000000000670f60b9298a78072553e908dc87561ef39abcd63be902e82b905d86da8353f90418ce7532b222208446d793c026a970d85bd2ddf7bff2d529246aa7266ab4129c3a50121b5fd84259d66cd46123540766be93dfe6d43130d700000000000000000000000000000000000000000000000000000000000fb770"

  try {
    // @ts-ignore
    const hash = await paymasterContract.getHash(userOp, VALID_UNTIL, VALID_AFTER, tokenAddress, amount);
    console.log("Generated hash:", hash);
  } catch (error) {
    console.error("Error calling getHash:", error);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

