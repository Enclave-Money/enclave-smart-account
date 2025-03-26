import { ethers } from "hardhat";
import * as testnetContracts from "../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, ODYSSEY_SLUG, OP_SEPOLIA_SLUG, ETH_SEPOLIA_SLUG, MONAD_TEST_SLUG } from "../demo/socket/constants";

async function main() {
  const wallet = new ethers.Wallet(process.env.TEST_KEY as string, ethers.provider);
  console.log("Connecting settlement modules with account:", wallet.address);

  // Get contract factory
  const SettlementModule = await ethers.getContractFactory("SocketDLSettlementModule");

  // Transfer 0.005 ETH to the module
  // console.log("\nTransferring 0.005 ETH to settlement module...");
  // try {
  //   const tx = await deployer.sendTransaction({
  //     to: testnetContracts[MONAD_TEST_SLUG].module,
  //     value: ethers.parseEther("0.005"),
  //     gasLimit: 1000000
  //   });
  //   await tx.wait();
  //   console.log("✓ Successfully transferred 0.005 ETH to module");
  // } catch (error) {
  //   console.error("Failed to transfer ETH to module:", error);
  // }

  // Connect Arbitrum Sepolia to Monad Testnet
  // console.log("\nConnecting Arbitrum Sepolia to Monad Testnet...");
  // const settlementModule = SettlementModule.attach(testnetContracts[ARB_SEPOLIA_SLUG].module).connect(wallet) as any;

  // try {
  //   const tx1 = await settlementModule.connectToPlug(
  //     MONAD_TEST_SLUG,
  //     testnetContracts[MONAD_TEST_SLUG].module
  //   );
  //   await tx1.wait();
  //   console.log("✓ Arbitrum Sepolia connected to Monad Testnet");
  // } catch (error) {
  //   console.error("Failed to connect Arbitrum Sepolia to Monad Testnet:", error);
  // }

  // Optimism Sepolia to Monad Testnet
  // console.log("\nConnecting Optimism Sepolia to Monad Testnet...");
  // const settlementModule2 = SettlementModule.attach(testnetContracts[OP_SEPOLIA_SLUG].module).connect(wallet) as any;

  // try {
  //   const tx2 = await settlementModule2.connectToPlug(
  //     MONAD_TEST_SLUG,
  //     testnetContracts[MONAD_TEST_SLUG].module
  //   );
  //   await tx2.wait();
  //   console.log("✓ Optimism Sepolia connected to Monad Testnet");
  // } catch (error) {
  //   console.error("Failed to connect Optimism Sepolia to Monad Testnet:", error);
  // }

  // Connect Monad Testnet to Arbitrum Sepolia
  console.log("\nConnecting Monad Testnet to Arbitrum Sepolia...");
  const settlementModule3 = SettlementModule.attach(testnetContracts[MONAD_TEST_SLUG].module).connect(wallet) as any;

  try {
    const tx3 = await settlementModule3.connectToPlug(
      ARB_SEPOLIA_SLUG,
      testnetContracts[ARB_SEPOLIA_SLUG].module
    );
    await tx3.wait();
    console.log("✓ Monad Testnet connected to Arbitrum Sepolia");
  } catch (error) {
    console.error("Failed to connect Monad Testnet to Arbitrum Sepolia:", error);
  }

  // Connect Monad Testnet to Optimism Sepolia
  console.log("\nConnecting Monad Testnet to Optimism Sepolia...");
  const settlementModule4 = SettlementModule.attach(testnetContracts[MONAD_TEST_SLUG].module).connect(wallet) as any;

  try {
    const tx4 = await settlementModule4.connectToPlug(
      OP_SEPOLIA_SLUG,
      testnetContracts[OP_SEPOLIA_SLUG].module
    );
    await tx4.wait();
    console.log("✓ Monad Testnet connected to Optimism Sepolia");
  } catch (error) {
    console.error("Failed to connect Monad Testnet to Optimism Sepolia:", error);
  }

  // // Connect Arbitrum Sepolia to Odyssey
  // console.log("\nConnecting A to C...");
  // try {
  //   const tx3 = await settlementModule.connectToPlug(
  //     OP_SEPOLIA_SLUG,
  //     testnetContracts[OP_SEPOLIA_SLUG].module
  //   );
  //   await tx3.wait();
  //   console.log("✓ A connected to C");
  // } catch (error) {
  //   console.error("Failed to connect A to C:", error);
  // }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
