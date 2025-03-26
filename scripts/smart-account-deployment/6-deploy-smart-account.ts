import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SmartAccount with the account:", deployer.address);

  // Get required addresses
  const factoryAddress = "0x8dbf2c01d73334a45192317fE1E92E8aA63f9eda";
  const enclaveRegistry = "0xf8D2b1849237895e67179937F09D739fFA822282";

  // The owner address for the smart account (this can be an EOA or another contract)
  const ownerAddress = deployer.address;
  console.log(`Using owner address: ${ownerAddress}`);

  // Connect to the factory contract
  const SmartAccountFactoryV1 = await ethers.getContractFactory("SmartAccountFactoryV1");
  const factory = SmartAccountFactoryV1.attach(factoryAddress) as any; 

  const salt = "0x0000000000000000000000000000000000000000000000000000000000000000";

  // Create the SmartAccount
  const tx = await factory.createAccount(ownerAddress, enclaveRegistry, salt);
  const receipt = await tx.wait();
  console.log("Account created at:", receipt);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 