import { ethers } from "hardhat";
import { getCreate2Address } from "ethers";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Add salt for CREATE2 deployment
  const salt = ethers.id("v1");

  // 1. Deploy P256Verifier
  const P256Verifier = await ethers.getContractFactory("P256Verifier");
  const p256Verifier = await P256Verifier.deploy();
  const initCodeHash = ethers.keccak256(P256Verifier.bytecode);
  const create2Address = getCreate2Address(deployer.address, salt, initCodeHash);
  await p256Verifier.waitForDeployment();
  const p256VerifierAddress = await p256Verifier.getAddress();
  console.log("P256Verifier deployed to:", p256VerifierAddress);

  // 2. Deploy P256V
  const P256V = await ethers.getContractFactory("P256V");
  const p256v = await P256V.deploy(p256VerifierAddress);
  await p256v.waitForDeployment();
  const p256vAddress = await p256v.getAddress();
  console.log("P256V deployed to:", p256vAddress);

  // 3. Deploy EnclaveRegistry
  const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
  const enclaveRegistry = await EnclaveRegistry.deploy(deployer.address);
  await enclaveRegistry.waitForDeployment();
  const registryAddress = await enclaveRegistry.getAddress();
  console.log("EnclaveRegistry deployed to:", registryAddress);

  // 4. Deploy P256SmartAccountFactoryV1
  const P256SmartAccountFactory = await ethers.getContractFactory("P256SmartAccountFactoryV1");
  const p256SmartAccountFactory = await P256SmartAccountFactory.deploy();
  await p256SmartAccountFactory.waitForDeployment();
  const factoryAddress = await p256SmartAccountFactory.getAddress();
  console.log("P256SmartAccountFactoryV1 deployed to:", factoryAddress);

  // 5. Deploy Validator Modules
  // a. P256Validator
  const P256Validator = await ethers.getContractFactory("P256Validator");
  const p256Validator = await P256Validator.deploy(registryAddress);
  await p256Validator.waitForDeployment();
  const p256ValidatorAddress = await p256Validator.getAddress();
  console.log("P256Validator deployed to:", p256ValidatorAddress);

  // b. ECDSAValidator
  const ECDSAValidator = await ethers.getContractFactory("ECDSAValidator");
  const ecdsaValidator = await ECDSAValidator.deploy();
  await ecdsaValidator.waitForDeployment();
  const ecdsaValidatorAddress = await ecdsaValidator.getAddress();
  console.log("ECDSAValidator deployed to:", ecdsaValidatorAddress);

  // c. MultichainP256Validator
  const MultichainP256Validator = await ethers.getContractFactory("MultichainP256Validator");
  const multichainP256Validator = await MultichainP256Validator.deploy(registryAddress);
  await multichainP256Validator.waitForDeployment();
  const multichainP256ValidatorAddress = await multichainP256Validator.getAddress();
  console.log("MultichainP256Validator deployed to:", multichainP256ValidatorAddress);

  // d. MultichainECDSAValidator
  const MultichainECDSAValidator = await ethers.getContractFactory("MultichainECDSAValidator");
  const multichainECDSAValidator = await MultichainECDSAValidator.deploy();
  await multichainECDSAValidator.waitForDeployment();
  const multichainECDSAValidatorAddress = await multichainECDSAValidator.getAddress();
  console.log("MultichainECDSAValidator deployed to:", multichainECDSAValidatorAddress);

  // Update Registry with addresses
  console.log("Updating registry addresses...");
  await enclaveRegistry.updateRegistryAddress("p256Verifier", p256vAddress);
  await enclaveRegistry.updateRegistryAddress("P256Validator", p256ValidatorAddress);
  await enclaveRegistry.updateRegistryAddress("ECDSAValidator", ecdsaValidatorAddress);
  await enclaveRegistry.updateRegistryAddress("MultichainP256Validator", multichainP256ValidatorAddress);
  await enclaveRegistry.updateRegistryAddress("MultichainECDSAValidator", multichainECDSAValidatorAddress);

  console.log("All contracts deployed and registry updated successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
