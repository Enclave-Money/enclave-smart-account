// ARB SEPOLIA - 421614
// EnclaveVirtualLiquidityVault deployed to: 0x7d87C9A0a3F8D978bF248d6EC5F56D5ed3a03F05
// Configuration:
// - Owner: 0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00
// - EntryPoint: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
// - Socket Contract: 0x5798C2D27Db969fda2E43dE0871C21823E6418B8
// - Inbound Smart Balance: 0x545549DF14D755af886168987f3be621D6Ed3FaD
// - Outbound Smart Balance: 0x545549DF14D755af886168987f3be621D6Ed3FaD

// OP SEPOLIA - 11155420
// EnclaveVirtualLiquidityVault deployed to: 0x57e3Cd7D6Bf7BA15c95Dcf3a71adf9056dCaF373
// Configuration:
// - Owner: 0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00
// - EntryPoint: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
// - Socket Contract: 0xCF8dc30B0c79eA64D6D82f0bb9258176E88004C6
// - Inbound Smart Balance: 0xeDA3cFD23DA02CB14E36125c2E8709a4574D9f04
// - Outbound Smart Balance: 0xeDA3cFD23DA02CB14E36125c2E8709a4574D9f04

// ODYSSEY - 911867
// EnclaveVirtualLiquidityVault deployed to: 0xAd6fFcA22E0f19A47065712C1bc01Aee42C4CdA5
// Configuration:
// - Owner: 0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00
// - EntryPoint: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
// - Socket Contract: 0x5C4186D343EeF952c9ED886E45F8243edf0A503F
// - Inbound Smart Balance: 0xe1e0d782E3b4985f1d657f77B683897AeA6b7dC9
// - Outbound Smart Balance: 0xe1e0d782E3b4985f1d657f77B683897AeA6b7dC9


import { ethers } from "hardhat";
import * as testnetContracts from "../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, ODYSSEY_SLUG, OP_SEPOLIA_SLUG } from "./constants";


async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Connecting plugs with account:", deployer.address);

  // Vault addresses from the deployment

  const SRC_CHAIN = ARB_SEPOLIA_SLUG;
  const DESTINATION_CHAIN = ODYSSEY_SLUG

  // Get contract factory
  const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");

  // Connect OP Sepolia vault to Odyssey vault
  console.log("Connecting: ", SRC_CHAIN, DESTINATION_CHAIN)
  const vault = VaultFactory.attach(testnetContracts[SRC_CHAIN].socket.plug);
//@ts-ignore
console.log("SOCKET: ", await vault.socket());
//@ts-ignore
console.log("INBOUND SB: ", await vault.inboundSwitchBoard());
//@ts-ignore
console.log("OUTBOUND SB: ", await vault.outboundSwitchBoard());
//@ts-ignore
const tx1 = await vault.connectToPlug(
    DESTINATION_CHAIN,
    testnetContracts[DESTINATION_CHAIN].socket.plug
);
await tx1.wait();
console.log("Connected: ", SRC_CHAIN, DESTINATION_CHAIN)

//   // Connect Odyssey vault to OP Sepolia vault
//   console.log("\nConnecting Odyssey vault to OP Sepolia vault...");
//   const odysseyVault = VaultFactory.attach(vaultAddresses[ODYSSEY_SLUG]);
//   try {
//     //@ts-ignore
//     const tx2 = await odysseyVault.connectToPlug(
//       OP_SEPOLIA_SLUG,
//       vaultAddresses[OP_SEPOLIA_SLUG]
//     );
//     await tx2.wait();
//     console.log("✓ Odyssey vault connected to OP Sepolia vault");
//   } catch (error) {
//     console.error("Failed to connect Odyssey vault:", error);
//   }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
