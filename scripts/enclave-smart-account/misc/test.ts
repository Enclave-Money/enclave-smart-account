const contractAddress = "0x58d05219cf14739512bc6fbe9c82f3b33502e6d6";
const hash = "0x6b35e39022f2df2068064fb79c25652dcb733ea0703aaf11ae5087e7e6cb8de4";
const signature = "0x9925bf2330f29a11210c2bb980e726e7cf42856b369567132fa37fa50b2d792f754f6564b0d04abb3ca407e6efaac5dee7624deda8f69994767415845a6ad4a91c";
import * as dotenv from 'dotenv';
import { ethers } from "hardhat";

// Load environment variables
const env = dotenv.config();
if (env.error) {
    throw new Error('Error loading .env file');
}

async function main() {

    // Get contract instance

    const fac = await ethers.getContractFactory("SmartAccountV1");
    const acct = fac.attach(contractAddress);

    // Recover address from signature
    const recoveredAddress = ethers.recoverAddress(hash, signature);
    console.log("Recovered address:", recoveredAddress);

    // Get contract owner
    //@ts-ignore
    const owner = await acct.owner();
    console.log("Contract owner:", owner);

    // Compare addresses
    const isMatch = recoveredAddress.toLowerCase() === owner.toLowerCase();
    console.log("Addresses match:", isMatch);

    // Get module manager address from registry
    //@ts-ignore
    const registry = await acct.enclaveRegistry();
    const registryContract = await ethers.getContractAt("EnclaveRegistryV0", registry);
    const moduleManagerAddress = await registryContract.getRegistryAddress(ethers.keccak256(ethers.toUtf8Bytes("moduleManager")));
    console.log("Module manager address:", moduleManagerAddress);

    // Check if module is enabled
    const moduleManager = await ethers.getContractAt("EnclaveModuleManager", moduleManagerAddress);
    const moduleAddress = "0xe21a41Cc5DA65929d02eee29299eE74fda636aDc";
    const isEnabled = await moduleManager.isModuleEnabled(moduleAddress);
    console.log("Module enabled:", isEnabled);

    // Encode module address and signature
    const encodedSig = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'bytes'], [
        moduleAddress,
        signature
    ]);
    console.log("Encoded signature:", encodedSig);

    // const module = await ethers.getContractAt("SmartAccountECDSAValidator", moduleAddress);
    // const res = await module.isValidSignatureWithSender(contractAddress, hash, encodedSig);
    // console.log('RES1: ', res);

    //@ts-ignore
    const res2 = await acct.isValidSignature(hash, encodedSig);
    console.log('RES2: ', res2);

}

main().catch(console.error);