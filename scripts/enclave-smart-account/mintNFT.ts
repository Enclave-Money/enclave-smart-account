import { ethers } from "hardhat";

async function main() {
    const [deployer, deployer2] = await ethers.getSigners();

    const gasNFT = await ethers.getContractFactory("GasNFT"); // Replace with your contract address
    const contract = gasNFT.attach("0x859F6ac605D36EDDeF68459D3e16cc3BE7401ee5");

    // @ts-ignore
    const tx = await contract.mintNFT(deployer2.address);
    await tx.wait();

    console.log("NFT minted successfully");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});