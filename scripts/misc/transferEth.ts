import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();

    const recipientAddress = '0xFe7bd528ec2375a3d6Bd3fB37E55f6BD7ae229aa';
    const amountInEther = '0.001'; // Amount to send in ETH

    const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: ethers.parseEther(amountInEther),
    });
    console.log("Transaction hash:", tx.hash);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});