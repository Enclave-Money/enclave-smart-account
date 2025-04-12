import { ethers } from "hardhat";
import * as mainnetContracts from "../../../../config/mainnetDeploymentContracts.json";
import { ARB_MAIN_SLUG, OP_MAIN_SLUG, BASE_MAIN_SLUG } from "../../../demo/socket/constants";
import { SocketDLSettlementModule } from "../../../../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Connecting settlement modules with account:", deployer.address);

  const networkA = BASE_MAIN_SLUG;

  const networkB1 = ARB_MAIN_SLUG;
  const networkB2 = OP_MAIN_SLUG;

  // Get contract factory
  const SettlementModule = await ethers.getContractFactory("SocketDLSettlementModule");

  // Transfer 0.005 ETH to the module
  console.log("\nTransferring 0.005 ETH to settlement module...");
  try {
    const tx = await deployer.sendTransaction({
      to: mainnetContracts[networkA].settlementModules.socketDLSettlementModule,
      value: ethers.parseEther("0.005"),
      gasLimit: 1000000
    });
    await tx.wait();
    console.log("✓ Successfully transferred 0.005 ETH to module");
  } catch (error) {
    console.error("Failed to transfer ETH to module:", error);
  }

  const settlementModule = SettlementModule.attach(mainnetContracts[networkA].settlementModules.socketDLSettlementModule) as SocketDLSettlementModule;

  console.log("\nConnecting A to B1...");
  try {
    const tx1 = await settlementModule.connectToPlug(
      networkB1,
      mainnetContracts[networkB1].settlementModules.socketDLSettlementModule
    );
    await tx1.wait();
    console.log("✓ A connected to B1");
  } catch (error) {
    console.error("Failed to connect A to B1:", error);
  }

  console.log("\nConnecting A to B2...");
  try {
    const tx2 = await settlementModule.connectToPlug(
      networkB2,
      mainnetContracts[networkB2].settlementModules.socketDLSettlementModule
    );
    await tx2.wait();
    console.log("✓ A connected to B2");
  } catch (error) {
    console.error("Failed to connect A to B2:", error);
  }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
