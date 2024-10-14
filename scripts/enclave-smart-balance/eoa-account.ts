import { Addressable } from "ethers";
import { ethers } from "hardhat";

async function deployEntrypoint() {
    const Entrypoint__factory = await ethers.getContractFactory("Entrypoint");
    const entrypoint = await Entrypoint__factory.deploy();
    await entrypoint.waitForDeployment();
    
    console.log("Entrypoint deployed to:", entrypoint.target);
    return entrypoint.target;
}

async function getEntrypointContract(address: string | Addressable) {
    const Entrypoint__factory = await ethers.getContractFactory("Entrypoint");
    const entrypoint = Entrypoint__factory.attach(address);
    return entrypoint;
}

async function deploySmartAccountFactory() {
    const SmartAccountFactory__factory = await ethers.getContractFactory("SmartAccountFactory");
    const factory = await SmartAccountFactory__factory.deploy();
    await factory.waitForDeployment();
    
    console.log("SmartAccountFactory deployed to:", factory.target);
    return factory.target;
}

async function getSmartAccountFactory(address: string | Addressable) {
    const SmartAccountFactory__factory = await ethers.getContractFactory("SmartAccountFactory");
    const factory = SmartAccountFactory__factory.attach(address);
    return factory;
}

async function deploySmartAccount(
  factoryAddress: string | Addressable,
  ownerAddress: string | Addressable,
  entrypointAddress: string | Addressable
) {
    const factory = await getSmartAccountFactory(factoryAddress);
    
    // Get contract address
    // @ts-ignore
    const contractAddress = await factory.getAccountAddress(ownerAddress, entrypointAddress, 0);
    console.log("Contract address:", contractAddress);

    // Deploy wallet
    // @ts-ignore
    const tx = await factory.createAccount(ownerAddress, entrypointAddress);
    const receipt = await tx.wait();
    
    console.log("Smart Account deployed to:", contractAddress);
    return contractAddress;
}

async function main() {
    const ownerAddress = "0x0000000000000000000000000000000000000000";

    const entrypointAddress = await deployEntrypoint();
    // const entrypointAddress = "0x0000000000000000000000000000000000000000";

    const factoryAddress = await deploySmartAccountFactory();
    // const factoryAddress = "0x0000000000000000000000000000000000000000";

    const contractAddress = await deploySmartAccount(factoryAddress, ownerAddress, entrypointAddress);
    console.log("Contract address:", contractAddress);
}

main();

// Export the functions
export { deploySmartAccountFactory, deploySmartAccount };

