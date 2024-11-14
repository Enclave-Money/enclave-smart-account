import { ethers } from "hardhat";

async function main() {

  // USE DEPLOYMENT KEY FOR SAME ADDR DEPLOYMENT

  const ENTRYPOINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  const GatewayContractArb = "0xc21e4ebd1d92036cb467b53fe3258f219d909eb9";
  const GatewayContractOp = "0x86dfc31d9cb3280ee1eb1096caa9fc66299af973";
  const GatewayContractBase = "0x86dfc31d9cb3280ee1eb1096caa9fc66299af973"

  const GatewayMap = {
    42161: GatewayContractArb,
    10: GatewayContractOp,
    8453: GatewayContractBase
  };

  const CHAIN = 8453

  const VerifyingSigner = "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00";
  
  const routerChainId = "router_9600-1"
  const routerRNSAddress = "router12xgvfsvqsp6gw8pd7ven73t07wnz78vvqdxt898tmzmsuhxk0amqkmxg5j";

  const paymasterContractFactory = await ethers.getContractFactory("EnclaveSolverPaymasterV2B");

  const paymasterContract = await paymasterContractFactory.deploy(
    VerifyingSigner,
    ENTRYPOINT,
    GatewayMap[CHAIN],
    routerRNSAddress,
    routerChainId
  );
  await paymasterContract.waitForDeployment();
  console.log("Paymaster contract deployed at: ", CHAIN, paymasterContract.target);

  //@ts-ignore
  // const tx = await paymasterContract.setDappMetadata(VerifyingSigner);
  // await tx.wait();
  // console.log("Fee payer set", CHAIN);

  // //@ts-ignore
  // const tx2 = await paymasterContract.deposit({ value: ethers.parseEther('0.001') });
  // await tx2.wait();
  // console.log("deposited", CHAIN);

  // const vaultContract = await vaultContractFactory.deploy(
  //   VerifyingSigner,
  //   GatewayContractOpSep,
  //   routerRNSAddress,
  //   routerChainId
  // );
  // await vaultContract.waitForDeployment();
  // console.log("Vault contract: ", vaultContract.target);


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

