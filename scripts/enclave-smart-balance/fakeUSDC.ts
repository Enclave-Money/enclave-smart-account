import { Addressable } from "ethers";
import { ethers } from "hardhat";

async function deployMockUSDC() {
    const MockUSDC__factory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC__factory.deploy("USDM", "USD Mock");
    await mockUSDC.waitForDeployment();

    console.log("USD Mock deployed to: ", mockUSDC.target);
    return mockUSDC;
}

async function getMockUSDC(address: string | Addressable) {
    const MockUSDC__factory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = MockUSDC__factory.attach(address);
    return mockUSDC;
}

async function getSmartAccountFactory(address: string | Addressable) {
    const SmartAccountFactory__factory = await ethers.getContractFactory("SmartAccountFactory");
    const factory = SmartAccountFactory__factory.attach(address);
    return factory;
}

async function main() {
    const userAddress = "0x51A20b575d36d50c910fEFCD2c7A0eBe41DE3802";
    const factoryAddress = "0xb1570eE5752940163aAd2F10aE3847ca0f674133";
    const entrypointAddress = "0xF522AA3eC4dA6237a9570021AB6187Ca111aa8b3";

    const factory = await getSmartAccountFactory(factoryAddress);

    // @ts-ignore
    const smartAccountAddress = await factory.getAccountAddress(userAddress, entrypointAddress, 0);
    // @ts-ignore
    const smartAccount = await factory.createAccount(userAddress, entrypointAddress, 0);
    console.log("Smart account created: ", smartAccountAddress);

    const mockUSDC = await deployMockUSDC();

    await mockUSDC.mint(smartAccountAddress, ethers.parseEther("10000000000000000"));
    console.log("Minted 10000 USDM to user");

    const balance = await mockUSDC.balanceOf(smartAccountAddress);
    console.log("Balance of user: ", balance);
}

main();

// Export the functions
export { deployMockUSDC, getMockUSDC };

