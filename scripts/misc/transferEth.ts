import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();

    // const recipientAddress = '0xFe7bd528ec2375a3d6Bd3fB37E55f6BD7ae229aa';
    // const recipientAddress = '0xd11b1d18392bEE5a5A95F7e4Abb4bEDfa1Eb6959';
    const recipientAddress = '0xca590F4dfEcD2763c11918b759EFF1FF709E77B0';
    const amountInEther = '1'; // Amount to send in ETH

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