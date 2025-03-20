import { ethers } from "hardhat";
import * as testnetContracts from "../../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, ODYSSEY_SLUG, OP_SEPOLIA_SLUG, ETH_SEPOLIA_SLUG, MONAD_TEST_SLUG } from "../../../demo/socket/constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Connecting settlement modules with account:", deployer.address);

  // Get contract factory
  const SettlementModule = await ethers.getContractFactory("SocketDLSettlementModule");

  // Transfer 0.005 ETH to the module
  console.log("\nTransferring 0.005 ETH to settlement module...");
  try {
    const tx = await deployer.sendTransaction({
      to: testnetContracts[OP_SEPOLIA_SLUG].module,
      value: ethers.parseEther("0.005")
    });
    await tx.wait();
    console.log("✓ Successfully transferred 0.005 ETH to module");
  } catch (error) {
    console.error("Failed to transfer ETH to module:", error);
  }

  // Connect Arbitrum Sepolia to OP Sepolia
  console.log("\nConnecting A to B...");
  const settlementModule = SettlementModule.attach(testnetContracts[OP_SEPOLIA_SLUG].module);

  try {
    const tx1 = await settlementModule.connectToPlug(
      ARB_SEPOLIA_SLUG,
      testnetContracts[ARB_SEPOLIA_SLUG].module
    );
    await tx1.wait();
    console.log("✓ A connected to B");
  } catch (error) {
    console.error("Failed to connect A to B:", error);
  }

  // // Connect Arbitrum Sepolia to Odyssey
  // console.log("\nConnecting A to C...");
  // try {
  //   const tx3 = await settlementModule.connectToPlug(
  //     MONAD_TEST_SLUG,
  //     testnetContracts[MONAD_TEST_SLUG].module
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
