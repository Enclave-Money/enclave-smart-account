import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting ModuleManager in EnclaveRegistry with account:", deployer.address);
  
  const enclaveRegistryAddress = "0xf8D2b1849237895e67179937F09D739fFA822282";
  const enclaveModuleManagerAddress = "0xf08cb9409a1f6D761a81369F9e2E4f54638C5B96";

  console.log(`Using EnclaveRegistry at: ${enclaveRegistryAddress}`);
  console.log(`Using EnclaveModuleManager at: ${enclaveModuleManagerAddress}`);

  // Connect to the registry contract
  const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
  const enclaveRegistry = EnclaveRegistry.attach(enclaveRegistryAddress) as any;

  // Set the ModuleManager in the registry
  const setModuleManagerTx = await enclaveRegistry.updateRegistryAddress("moduleManager", enclaveModuleManagerAddress);
  await setModuleManagerTx.wait();
  console.log(`Set ModuleManager (${enclaveModuleManagerAddress}) in registry`);

  return;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 