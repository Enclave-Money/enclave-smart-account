import { Addressable } from "ethers";
import { ethers } from "hardhat";

async function deployEntrypoint() {
    const Entrypoint__factory = await ethers.getContractFactory("EntryPoint");
    const entrypoint = await Entrypoint__factory.deploy();
    await entrypoint.waitForDeployment();
    
    console.log("Entrypoint deployed to:", entrypoint.target);
    return entrypoint;
}

async function getEntrypointContract(address: string | Addressable) {
    const Entrypoint__factory = await ethers.getContractFactory("EntryPoint");
    const entrypoint = Entrypoint__factory.attach(address);
    return entrypoint;
}

async function deploySmartAccountFactory() {
    const SmartAccountFactory__factory = await ethers.getContractFactory("SmartAccountFactory");
    const factory = await SmartAccountFactory__factory.deploy();
    await factory.waitForDeployment();
    
    console.log("SmartAccountFactory deployed to:", factory.target);
    return factory;
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

async function deploySolverPaymaster(entrypointAddress: string | Addressable, verifyingSigner: string | Addressable) {
    const SolverPaymaster__factory = await ethers.getContractFactory("EnclaveSolverPaymaster");
    const paymaster = await SolverPaymaster__factory.deploy(entrypointAddress, verifyingSigner);
    await paymaster.waitForDeployment();
    
    console.log("SolverPaymaster deployed to:", paymaster.target);
    return paymaster;
}

async function getSolverPaymaster(solverPaymasterAddress: string | Addressable) {
    const SolverPaymaster__factory = await ethers.getContractFactory("EnclaveSolverPaymaster");
    const paymaster = SolverPaymaster__factory.attach(solverPaymasterAddress);
    return paymaster;
}

async function main() {
    const paymasterEOA = "0x399e8917Cd7Ce367b06bFfd0863E465B0Fd950dB";

    const entrypoint = await deployEntrypoint();
    // const entrypoint = await getEntrypointContract("0xF522AA3eC4dA6237a9570021AB6187Ca111aa8b3");

    const factory = await deploySmartAccountFactory();
    // const factory = await getSmartAccountFactory("0xb1570eE5752940163aAd2F10aE3847ca0f674133");

    const solverPaymaster = await deploySolverPaymaster(entrypoint.target, paymasterEOA);
    // const solverPaymaster = await getSolverPaymaster("0x1d4146d4a7d315f96e17a4c0C7deB40D835d0941");

    // @ts-ignore
    await solverPaymaster.deposit({value: ethers.parseEther("0.01")});
    console.log("Deposited to SolverPaymaster");
    // const contractAddress = await deploySmartAccount(factoryAddress, ownerAddress, entrypointAddress);
    // console.log("Contract address:", contractAddress);
}

main();

// Export the functions
export { deploySmartAccountFactory, deploySmartAccount };

