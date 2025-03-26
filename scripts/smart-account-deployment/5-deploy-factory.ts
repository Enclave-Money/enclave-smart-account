import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SmartAccountFactoryV1 with the account:", deployer.address);

  // Define a salt for CREATE2
  const salt = ethers.ZeroHash; // You can use any 32-byte value

  // Get the contract factory
  const SmartAccountFactoryV1 = await ethers.getContractFactory("SmartAccountFactoryV1");

  // Compute the deterministic address
  const bytecode = SmartAccountFactoryV1.bytecode;
  const constructorArgs: any[] = []; // Add constructor arguments if required
  const encodedArgs = SmartAccountFactoryV1.interface.encodeDeploy(constructorArgs);
  const initCode = ethers.concat([bytecode, encodedArgs]);

  const deterministicAddress = ethers.getCreate2Address(
    deployer.address, // Deployer's address
    salt,             // Salt
    ethers.keccak256(initCode) // Hash of the contract's initialization code
  );

  console.log(`Expected deterministic address: ${deterministicAddress}`);

  // Deploy the contract using CREATE2
  const factory = await SmartAccountFactoryV1.deploy();
  
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log(`SmartAccountFactoryV1 deployed to: ${factoryAddress}`);

  const impl = await factory.accountImplementation();
  console.log(`SmartAccountFactoryV1 accountImplementation: ${impl}`);

  return;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
