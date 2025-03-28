import { ethers } from "hardhat";
import * as testnetContracts from "../../config/testnetContracts.json";
import {
	ARB_SEPOLIA_SLUG,
	OP_SEPOLIA_SLUG,
	MONAD_TEST_SLUG,
} from "../demo/socket/constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying EnclaveModuleManager with the account:", deployer.address);

  // Deploy ModuleManager
  const currentSlug = ARB_SEPOLIA_SLUG;

  const enclaveRegistryAddress = testnetContracts[currentSlug].enclaveRegistry;

  const EnclaveModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
  const moduleManager = await EnclaveModuleManager.deploy(enclaveRegistryAddress);
  await moduleManager.waitForDeployment();
  
  const moduleManagerAddress = await moduleManager.getAddress();
  console.log(`ModuleManager deployed to: ${moduleManagerAddress}`);

  // Enable the validator module
  const validatorAddress = testnetContracts[currentSlug].smartAccountECDSAValidator;

  const enableModuleTx = await moduleManager.enableModule(validatorAddress);
  await enableModuleTx.wait();
  console.log(`Enabled validator module (${validatorAddress}) in ModuleManager`);

  return;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 