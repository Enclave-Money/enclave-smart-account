import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function main() {
  const [signer, sessionKeySigner] = await ethers.getSigners();
  console.log("Main signer:", signer.address);
  console.log("Session key signer:", sessionKeySigner.address);

  // 1. Deploy EntryPoint
  const EntryPoint = await ethers.getContractFactory("EntryPoint");
  const entryPoint = await EntryPoint.deploy();
  await entryPoint.waitForDeployment();
  const entryPointAddress = await entryPoint.getAddress();
  console.log("EntryPoint deployed to:", entryPointAddress);

  // 2. Deploy EnclaveRegistry
  const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
  const enclaveRegistry = await EnclaveRegistry.deploy(signer.address);
  await enclaveRegistry.waitForDeployment();
  const enclaveRegistryAddress = await enclaveRegistry.getAddress();
  console.log("EnclaveRegistry deployed to:", enclaveRegistryAddress);

  // Update registry with EntryPoint address
  await enclaveRegistry.updateRegistryAddress("entryPoint", entryPointAddress);
  console.log("EntryPoint address set in registry");

  // 3. Deploy SimpleSessionKeyValidator
  const SimpleSessionKeyValidator = await ethers.getContractFactory("SimpleSessionKeyValidator");
  const sessionKeyValidator = await SimpleSessionKeyValidator.deploy();
  await sessionKeyValidator.waitForDeployment();
  const validatorAddress = await sessionKeyValidator.getAddress();
  console.log("SimpleSessionKeyValidator deployed to:", validatorAddress);

  // Deploy SmartAccountECDSAValidator
  const ECDSAValidator = await ethers.getContractFactory("SmartAccountECDSAValidator");
  const ecdsaValidator = await ECDSAValidator.deploy();
  await ecdsaValidator.waitForDeployment();
  const ecdsaValidatorAddress = await ecdsaValidator.getAddress();
  console.log("SmartAccountECDSAValidator deployed to:", ecdsaValidatorAddress);

  // 4. Deploy SmartAccountFactory
  const SmartAccountFactory = await ethers.getContractFactory("SmartAccountFactoryV1");
  const factory = await SmartAccountFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("SmartAccountFactory deployed to:", factoryAddress);

  // 5. Deploy SmartAccount using factory with enclaveRegistry
  const createAccountTx = await factory.createAccount(signer.address, enclaveRegistryAddress, 0);
  await createAccountTx.wait();
  
  const smartAccountAddress = await factory.getAccountAddress(signer.address, enclaveRegistryAddress, 0);
  console.log("SmartAccount deployed to:", smartAccountAddress);

  // 6. Fund the smart account with 1 ETH
  const fundTx = await signer.sendTransaction({
    to: smartAccountAddress,
    value: ethers.parseEther("1.0")
  });
  await fundTx.wait();
  console.log("Funded smart account with 1 ETH");

  // 7. Enable session key
  const currentTime = Math.floor(Date.now() / 1000);
  const validUntil = currentTime + 300; // current time + 5 minutes
  const validAfter = currentTime - 10896737;

  const SmartAccount = await ethers.getContractFactory("SmartAccountV1");
  const smartAccount = SmartAccount.attach(smartAccountAddress);

  // Encode the validator enableSessionKey call
  const enableSessionKeyCall = sessionKeyValidator.interface.encodeFunctionData("enableSessionKey", [
    sessionKeySigner.address,
    validAfter,
    validUntil
  ]);

  // Create userOp to enable session key
  const enableSessionKeyOp = {
    sender: smartAccountAddress,
    //@ts-ignore
    nonce: await smartAccount.getNonce(),
    initCode: "0x",
    callData: smartAccount.interface.encodeFunctionData("execute", [
      validatorAddress,  // target is the validator
      0,                // no value transfer
      enableSessionKeyCall  // encoded validator call
    ]),
    callGasLimit: 100000,
    verificationGasLimit: 200000,
    preVerificationGas: 50000,
    maxFeePerGas: ethers.parseUnits("10", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
    paymasterAndData: "0x",
    signature: "0x"
  };

  // Sign and submit the enableSessionKey userOp
  const enableOpHash = await entryPoint.getUserOpHash(enableSessionKeyOp);
  const enableSignature = await signer.signMessage(ethers.getBytes(enableOpHash));
  enableSessionKeyOp.signature = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes"],
    [ecdsaValidatorAddress, enableSignature]
  );

  const enableTx = await entryPoint.handleOps([enableSessionKeyOp], signer.address);
  await enableTx.wait();
  console.log("Enabled session key for 5 minutes");

  // Check session key status
  const sessionKeyStatus = await sessionKeyValidator.getSessionKeyStatus(
    smartAccountAddress,
    sessionKeySigner.address
  );
  console.log("Session key status:", sessionKeyStatus);

  // 8. Create userOp to transfer 0.2 ETH
  const callData = smartAccount.interface.encodeFunctionData("execute", [
    sessionKeySigner.address,
    ethers.parseEther("0.2"),
    "0x"
  ]);

  const userOp = {
    sender: smartAccountAddress,
    //@ts-ignore
    nonce: await smartAccount.getNonce(),
    initCode: "0x",
    callData: callData,
    callGasLimit: 100000,
    verificationGasLimit: 200000,
    preVerificationGas: 50000,
    maxFeePerGas: ethers.parseUnits("10", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
    paymasterAndData: "0x",
    signature: "0x"
  };

  // 9. Sign the userOp with session key
  const userOpHash = await entryPoint.getUserOpHash(userOp);
  const signature = await sessionKeySigner.signMessage(ethers.getBytes(userOpHash));

  const encodedSignature = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes"],
    [validatorAddress, signature]
  );

  userOp.signature = encodedSignature;

  // 10. Submit the userOp
  const tx = await entryPoint.handleOps([userOp], signer.address);
  await tx.wait();
  console.log("UserOp executed successfully");

  // 11. Print final balances
  const sessionKeyBalance = await ethers.provider.getBalance(sessionKeySigner.address);
  const accountBalance = await ethers.provider.getBalance(smartAccountAddress);
  console.log("Session key balance:", ethers.formatEther(sessionKeyBalance), "ETH");
  console.log("Smart Account balance:", ethers.formatEther(accountBalance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
