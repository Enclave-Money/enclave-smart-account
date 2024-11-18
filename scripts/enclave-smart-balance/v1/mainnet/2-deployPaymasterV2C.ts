import { ethers } from "hardhat";
import { USDC_ADDRESSES } from "./0-constants";

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

  const paymasterContractFactory = await ethers.getContractFactory("EnclaveSolverPaymasterV2C");
  const paymasterContract = paymasterContractFactory.attach("0xB3a2729638C3667C9559DD75a3504C57D1025999")

  // const paymasterContract = await paymasterContractFactory.deploy(
  //   VerifyingSigner,
  //   ENTRYPOINT,
  //   GatewayMap[CHAIN],
  //   routerRNSAddress,
  //   routerChainId
  // );
  // await paymasterContract.waitForDeployment();
  console.log("Paymaster contract deployed at: ", CHAIN, paymasterContract.target);

  //@ts-ignore
  const tx1 = await paymasterContract.setDappMetadata(VerifyingSigner);
  await tx1.wait();
  console.log("Fee payer set", CHAIN);

  //@ts-ignore
  const tx2 = await paymasterContract.deposit({ value: ethers.parseEther('0.001') });
  await tx2.wait();
  console.log("deposited");

  const usdcFac = await ethers.getContractFactory("ERC20");
  //@ts-ignore
  const usdContract = usdcFac.attach(USDC_ADDRESSES[CHAIN]);

  //@ts-ignore
  let tx = await usdContract.transfer(paymasterContract.target, "3000000");
  await tx.wait();
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

