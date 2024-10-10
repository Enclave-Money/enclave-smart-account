import { ethers } from "hardhat";

async function main() {
    // const walletAddress = '0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00';
    const walletAddress = '0xFe7bd528ec2375a3d6Bd3fB37E55f6BD7ae229aa';
    const balance = await ethers.provider.getBalance(walletAddress);
    console.log("WEI Balance: ", balance);
    console.log("ETH Balance: ", ethers.formatEther(balance));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});