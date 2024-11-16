import { getContractFactory } from "@nomicfoundation/hardhat-ethers/types";
import { getBytes, keccak256, toUtf8Bytes } from "ethers";
import { ethers } from "hardhat";


async function main() {
  console.log(keccak256(toUtf8Bytes("smartBalanceConvert(address)")).slice(0, 10));

  const [signer] = await ethers.getSigners();

const entryPointFac = await ethers.getContractFactory("EntryPoint");
  const entryPoint = await entryPointFac.deploy();
  await entryPoint.waitForDeployment();
  console.log("EntryPoint: ", entryPoint.target);

  const registryFac = await ethers.getContractFactory("EnclaveRegistry");
  const registry = await registryFac.deploy(signer.address);
  await registry.waitForDeployment();
  console.log("Registry: ", registry.target);

  let tx = await registry.updateRegistryAddress("entryPoint", entryPoint.target);
  await tx.wait();

  const smartBalValFac = await ethers.getContractFactory("SmartBalanceKeyValidator");
  const smartBalVal = await smartBalValFac.deploy(registry.target);
  await smartBalVal.waitForDeployment();
  console.log("SmartBalanceKeyValidator: ", smartBalVal.target);

    tx = await registry.updateRegistryAddress("smartBalanceConversionManager", signer.address);
    await tx.wait();

  tx = await registry.updateRegistryAddress("SessionKeyValidator", smartBalVal.target);
    await tx.wait();

  const P256SmartAccountFactory = await ethers.getContractFactory("P256SmartAccountFactoryV1");
    const p256SmartAccountFactory = await P256SmartAccountFactory.deploy();
    await p256SmartAccountFactory.waitForDeployment();
    const p256SmartAccountFactoryAddress = await p256SmartAccountFactory.getAddress();
    console.log(`ENCLAVE_P256_SMART_ACCOUNT_FACTORY_ADDRESS=${p256SmartAccountFactoryAddress}`);

    const getDummyAddress = await p256SmartAccountFactory.getAccountAddress([1,2], registry.target, 0);
    console.log("Dummy Address: ", getDummyAddress);

    const tx2 = await p256SmartAccountFactory.createAccount([1,2], registry.target, 0);
    await tx2.wait();

    const transferTx = await signer.sendTransaction({
        to: getDummyAddress,
        value: ethers.parseEther("1.0")  // Sends 1 ETH, adjust amount as needed
    });
    await transferTx.wait();
    console.log("Transferred 1 ETH to:", getDummyAddress);

    const accountFac = await ethers.getContractFactory("P256SmartAccountV1");
    const account = accountFac.attach(getDummyAddress);

    const iface = new ethers.Interface(["function smartBalanceConvert(address)"]);
    const encodedData = iface.encodeFunctionData("smartBalanceConvert", [getDummyAddress]);
    console.log("Encoded call data:", encodedData);

    const accountInterface = new ethers.Interface([
        "function execute(address target, uint256 value, bytes calldata data) external payable returns (bytes memory)"
    ]);
    const executeCalldata = accountInterface.encodeFunctionData("execute", [
        getDummyAddress,  // target address (calling the account itself)
        0,               // value (0 ETH)
        encodedData      // the smartBalanceConvert encoded data
    ]);
    console.log("Execute function calldata:", executeCalldata);

    let hash = "0x3c19c25b60c82957f3d2b8a6a9f2a8e1f7d5d2c8b4e1a3f6d9c2b5e8a1d4f7c0";
    const signature = await signer.signMessage(getBytes(hash));

    const encodedSig = ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "bytes"], [4, signature]);

    const userOp = {
        sender: account.target,
        nonce: "27",
        initCode: "0x",
        callData: executeCalldata,
        callGasLimit: "198891",
        verificationGasLimit: "1000000",
        preVerificationGas: 300000,
        maxFeePerGas: "506",
        maxPriorityFeePerGas: 0,
        paymasterAndData: "0x",
        signature: encodedSig
    };

    const res = await smartBalVal.validateUserOp({
        ...userOp, signature
    }, hash);
    console.log("RES ABC: ", res);

    await ethers.provider.send("hardhat_impersonateAccount", [entryPoint.target]);
    const entryPointSigner = await ethers.getSigner(entryPoint.target as string);
    const accountAsEntryPoint = account.connect(entryPointSigner);

     // Fund the EntryPoint with some ETH to pay for gas
     await signer.sendTransaction({
        to: entryPoint.target,
        value: ethers.parseEther("1.0")
    });
    
    //@ts-ignore
    const res2 = await accountAsEntryPoint.validateUserOp(userOp, hash, 0);
    console.log("RES XYZ: ", res2);

    // Stop impersonating EntryPoint
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [entryPoint.target]);


}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
