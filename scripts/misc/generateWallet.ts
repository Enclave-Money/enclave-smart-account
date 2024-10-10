import { ethers } from "hardhat";

async function main() {
    const wallet = ethers.Wallet.createRandom();
    console.log("Wallet address:", wallet.address);
    console.log("Private key:", wallet.privateKey);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});