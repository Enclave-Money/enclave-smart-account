import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // First deploy EnclaveRegistry if not already deployed
  // If already deployed, you can attach to existing registry
//   const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
//   const enclaveRegistry = EnclaveRegistry.attach("");
//   const registryAddress = await enclaveRegistry.getAddress();
//   console.log("EnclaveRegistry deployed to:", registryAddress);

  const registryAddress = "0xA8E8f8cBD889Fc74882AeDFDcf8323fD7423DB47";
  const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
  const enclaveRegistry = EnclaveRegistry.attach(registryAddress);

  // Deploy SessionKeyAdapter
//   const SessionKeyAdapter = await ethers.getContractFactory("SessionKeyAdapter");
//   const sessionKeyAdapter = await SessionKeyAdapter.deploy();
//   await sessionKeyAdapter.waitForDeployment();
//   const sessionKeyAdapterAddress = await sessionKeyAdapter.getAddress();
//   console.log("SessionKeyAdapter deployed to:", sessionKeyAdapterAddress);

//   // Deploy TwitterSessionKeyValidator
//   const TwitterSessionKeyValidator = await ethers.getContractFactory("TwitterSessionKeyValidator");
//   const twitterSessionKeyValidator = await TwitterSessionKeyValidator.deploy(registryAddress);
//   await twitterSessionKeyValidator.waitForDeployment();
//   const twitterValidatorAddress = await twitterSessionKeyValidator.getAddress();
//   console.log("TwitterSessionKeyValidator deployed to:", twitterValidatorAddress);

  // Update registry with validator addresses
//   console.log("Updating registry addresses...");
  
//@ts-ignore
  console.log(await enclaveRegistry.getRegistryAddress(
    "SessionKeyValidator"
    // ,"0x380D4BD3F9f10eA5D24eaA0b87b7BF04c7732391"
  ));
  
//   await enclaveRegistry.updateRegistryAddress(
//     "TwitterSessionKeyValidator", 
//     twitterValidatorAddress
//   );

//   console.log("\nDeployment Summary:");
//   console.log("-------------------");
// //   console.log(`ENCLAVE_REGISTRY_ADDRESS=${registryAddress}`);
//   console.log(`SESSION_KEY_ADAPTER_ADDRESS=${sessionKeyAdapterAddress}`);
//   console.log(`TWITTER_SESSION_KEY_VALIDATOR_ADDRESS=${twitterValidatorAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});