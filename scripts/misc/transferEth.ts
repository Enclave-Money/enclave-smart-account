import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();

    console.log("SIGNER: ", signer.address);

    const recipientAddress = '0xf716DE79d0781614203BBB53951296E629fEb7fb';
    // const recipientAddress = '0xd11b1d18392bEE5a5A95F7e4Abb4bEDfa1Eb6959';
    // const recipientAddress = '0xca590F4dfEcD2763c11918b759EFF1FF709E77B0';
    const amountInEther = '0.0001'; // Amount to send in ETH

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