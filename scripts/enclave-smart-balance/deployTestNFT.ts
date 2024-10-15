import { Addressable } from "ethers";
import { ethers } from "hardhat";

async function deployTestNFT(mintPrice: number, usdc: string) {
    const TestNFT__factory = await ethers.getContractFactory("TestNFT");
    const testNFT = await TestNFT__factory.deploy(mintPrice, usdc);
    await testNFT.waitForDeployment();

    console.log("TestNFT deployed to: ", testNFT.target);
    return testNFT;
}

async function getTestNFT(address: string | Addressable) {
    const TestNFT__factory = await ethers.getContractFactory("TestNFT");
    const testNFT = TestNFT__factory.attach(address);
    return testNFT;
}

async function main() {
    // const userAddress = "0x51A20b575d36d50c910fEFCD2c7A0eBe41DE3802";
    const usdcAddress = "0x5fd84259d66Cd46123540766Be93DFE6D43130D7"; // op sepolia
    const mintPrice = 1000000;

    const testNFT = await deployTestNFT(mintPrice, usdcAddress);
}

main();

