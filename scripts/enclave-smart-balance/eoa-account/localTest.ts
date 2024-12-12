import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", signer.address);

  // 1. Deploy EntryPoint
  const EntryPoint = await ethers.getContractFactory("EntryPoint");
  const entryPoint = await EntryPoint.deploy();
  await entryPoint.waitForDeployment();
  const entryPointAddress = await entryPoint.getAddress();
  console.log("EntryPoint deployed to:", entryPointAddress);

  // Deploy EnclaveRegistry
  const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
  const enclaveRegistry = await EnclaveRegistry.deploy(signer.address);
  await enclaveRegistry.waitForDeployment();
  const enclaveRegistryAddress = await enclaveRegistry.getAddress();
  console.log("EnclaveRegistry deployed to:", enclaveRegistryAddress);

  await enclaveRegistry.updateRegistryAddress("entryPoint", entryPointAddress);
  console.log("EntryPoint set in registry");

  // 2. Deploy SmartAccountFactoryV1
  const SmartAccountFactory = await ethers.getContractFactory("SmartAccountFactoryV1");
  const factory = await SmartAccountFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("SmartAccountFactory deployed to:", factoryAddress);

  // 3. Deploy SmartAccountECDSAValidator
  const SmartAccountECDSAValidator = await ethers.getContractFactory("SmartAccountECDSAValidator");
  const ecdsaValidator = await SmartAccountECDSAValidator.deploy();
  await ecdsaValidator.waitForDeployment();
  const validatorAddress = await ecdsaValidator.getAddress();
  console.log("SmartAccountECDSAValidator deployed to:", validatorAddress);

  // 4. Deploy SmartAccountV1 using factory
  const createAccountTx = await factory.createAccount(signer.address, enclaveRegistryAddress, 0);
  await createAccountTx.wait();
  
  const smartAccountAddress = await factory.getAccountAddress(signer.address, enclaveRegistryAddress, 0);
  console.log("SmartAccount deployed to:", smartAccountAddress);

  // 5. Transfer 1 ETH to smart account
  const transferTx = await signer.sendTransaction({
    to: smartAccountAddress,
    value: ethers.parseEther("1.0")
  });
  await transferTx.wait();
  console.log("Transferred 1 ETH to smart account");

  // 6. Create and submit userOp to transfer 0.5 ETH
  const SmartAccount = await ethers.getContractFactory("SmartAccountV1");
  const smartAccount = SmartAccount.attach(smartAccountAddress);

  const callData = smartAccount.interface.encodeFunctionData("execute", [
    signer.address, // example recipient address
    ethers.parseEther("0.5"),
    "0x" // no data
  ]);

  const userOp = {
    sender: smartAccountAddress,
    //@ts-ignore
    nonce: await smartAccount.getNonce(),
    initCode: "0x",
    callData: callData,
    callGasLimit: 100000,
    verificationGasLimit: 100000,
    preVerificationGas: 50000,
    maxFeePerGas: ethers.parseUnits("10", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
    paymasterAndData: "0x",
    signature: "0x"
  };

  // Sign the userOp
  const userOpHash = await entryPoint.getUserOpHash(userOp);
  const signature = await signer.signMessage(ethers.getBytes(userOpHash));

  const encodedSignature = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes"],
    [validatorAddress, signature]
  );

  userOp.signature = encodedSignature;

  // Submit the userOp
  const tx = await entryPoint.handleOps([userOp], signer.address);
  await tx.wait();
  console.log("UserOp executed successfully");

  // Print ETH balances
  const signerBalance = await ethers.provider.getBalance(signer.address);
  const accountBalance = await ethers.provider.getBalance(smartAccountAddress);
  console.log("Signer balance:", ethers.formatEther(signerBalance), "ETH");
  console.log("Smart Account balance:", ethers.formatEther(accountBalance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
