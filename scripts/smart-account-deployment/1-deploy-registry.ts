import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying EnclaveRegistry with the account:", deployer.address);

  // Deploy EnclaveRegistry
  const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
  const enclaveRegistry = await EnclaveRegistry.deploy(deployer.address);
  await enclaveRegistry.waitForDeployment();
  
  const registryAddress = await enclaveRegistry.getAddress();
  console.log(`EnclaveRegistry deployed to: ${registryAddress}`);

  // Set entryPoint in the registry
  const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  await enclaveRegistry.updateRegistryAddress("entryPoint", entryPointAddress);
  console.log(`Set entryPoint (${entryPointAddress}) in registry`);
  
  // Set moduleManagerEoa in the registry
  const moduleManagerEoaAddress = deployer.address;
  await enclaveRegistry.updateRegistryAddress("moduleManagerEoa", moduleManagerEoaAddress);
  console.log(`Set moduleManagerEoa (${moduleManagerEoaAddress}) in registry`);

  return;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 