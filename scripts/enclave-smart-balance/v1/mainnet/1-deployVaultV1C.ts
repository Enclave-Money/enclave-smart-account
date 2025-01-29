import { ethers } from "hardhat";

async function main() {
    
  // USE DEPLOYMENT KEY FOR SAME ADDR DEPLOYMENT

  const GatewayContractArb = "0xc21e4ebd1d92036cb467b53fe3258f219d909eb9";
  const GatewayContractOp = "0x86dfc31d9cb3280ee1eb1096caa9fc66299af973";
  const GatewayContractBase = "0x86dfc31d9cb3280ee1eb1096caa9fc66299af973"

  const GatewayMap = {
    42161: GatewayContractArb,
    10: GatewayContractOp,
    8453: GatewayContractBase
  };

  const CHAIN = 42161;

  const vaultManager = "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00";
  
  const routerChainId = "router_9600-1"
  const routerRNSAddress = "router12xgvfsvqsp6gw8pd7ven73t07wnz78vvqdxt898tmzmsuhxk0amqkmxg5j";

  const vaultContractFactory = await ethers.getContractFactory("EnclaveTokenVaultV1C");
  const vaultContract = vaultContractFactory.attach("0x11DCe5ef6E4ADD33c694611da2E205B87Edd23FE");

  // Query and print the public variables
  const currentVaultManager = await vaultContract.isVaultManager(vaultManager);
  const currentRouterChainId = await vaultContract.routerChainId();
  const currentRouterRNSAddress = await vaultContract.routerRNSAddress();
  const currentGatewayContract = await vaultContract.gatewayContract();

  console.log("Vault Manager Status:", currentVaultManager);
  console.log("Router Chain ID:", currentRouterChainId);
  console.log("Router RNS Address:", currentRouterRNSAddress);
  console.log("Gateway Contract:", currentGatewayContract);

  // Original deposit check
  const deposit = await vaultContract.deposits("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "0x8c1e8f499472b83a0a96282ed5041c637a984aa1");
  console.log("Deposit:", deposit);

  console.log(deposit);

  // const vaultContract = await vaultContractFactory.deploy(
  //   vaultManager,
  //   GatewayMap[CHAIN],
  //   routerRNSAddress,
  //   routerChainId
  // );
  // await vaultContract.waitForDeployment();
  console.log("Vault contract: ", CHAIN, vaultContract.target);

  // Deployed at 0x11DCe5ef6E4ADD33c694611da2E205B87Edd23FE (42161, 10, 8453)
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

