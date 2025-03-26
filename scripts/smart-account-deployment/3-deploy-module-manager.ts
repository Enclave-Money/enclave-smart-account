import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying EnclaveModuleManager with the account:", deployer.address);

  // Deploy ModuleManager
  const enclaveRegistryAddress = "0xf8D2b1849237895e67179937F09D739fFA822282";

  const EnclaveModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
  const moduleManager = await EnclaveModuleManager.deploy(enclaveRegistryAddress);
  await moduleManager.waitForDeployment();
  
  const moduleManagerAddress = await moduleManager.getAddress();
  console.log(`ModuleManager deployed to: ${moduleManagerAddress}`);

  // Enable the validator module
  const validatorAddress = "0x5144b244774f89aD766aadD5ab72e9f9F24e4655"; //smartAccountECDSAValidator

  const enableModuleTx = await moduleManager.enableModule(validatorAddress);
  await enableModuleTx.wait();
  console.log(`Enabled validator module (${validatorAddress}) in ModuleManager`);

  return;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 