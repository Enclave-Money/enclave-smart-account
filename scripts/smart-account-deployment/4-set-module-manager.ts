import { ethers } from "hardhat";
import * as testnetContracts from "../../config/testnetContracts.json";
import {
	ARB_SEPOLIA_SLUG,
	OP_SEPOLIA_SLUG,
	MONAD_TEST_SLUG,
} from "../demo/socket/constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting ModuleManager in EnclaveRegistry with account:", deployer.address);
  
  const currentSlug = ARB_SEPOLIA_SLUG;
  
  const enclaveRegistryAddress = testnetContracts[currentSlug].enclaveRegistry;
  const enclaveModuleManagerAddress = testnetContracts[currentSlug].enclaveModuleManager;

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