import { ethers } from "hardhat";

async function main() {
    const verifyingSigner = await ethers.provider.getSigner();

    const ownerAddress = "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00"; // replace with the owner's address
    
    // Get eth balance
    const ethBalance = await ethers.provider.getBalance(ownerAddress);
    console.log("ETH balance: ", ethBalance.toString());

    // Transfer 0.04 to owner
    const tx = await verifyingSigner.sendTransaction({
        to: ownerAddress,
        value: ethers.parseEther("0.04")
    });

    await tx.wait();

    // Console log txn hash
    console.log("Transaction hash: ", tx.hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});